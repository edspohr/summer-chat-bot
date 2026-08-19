---
id: "2026-08-11"
title: "Cascading incident: Spark/Blaze image purge → Vertex AI DSQ throttling"
severity: high
status: mitigated
occurred: 2026-08-11
authored: 2026-08-12
scope: summer-chatbot-dev (production project untouched)
---

## Executive summary

On 2026-08-11 the Salvador (Martina) chatbot experienced two distinct failure modes in rapid
succession during a live formative workshop with ~50 participants. Both surfaced as HTTP 429 /
"CORS blocked" errors in the browser, which masked the fact that they had different root causes
and required different fixes. This document walks the incident chronologically, records the fix
that was shipped, and enumerates the mitigation options evaluated (implemented and rejected)
along with their trade-offs and rationale.

**Impact:** the morning workshop was substantially degraded; the chatbot was effectively
unusable for the first 20–30 minutes and intermittent thereafter. A code-level mitigation was
shipped in the afternoon; the following workshop was expected to see intermittent degradation
but not outright unavailability.

**Primary lesson:** two independent Google-side issues coincided with a billing plan change.
Rapid triage requires distinguishing which layer is producing the 429 (Cloud Run edge vs. Vertex
AI backend). We now have a memory note documenting the diagnostic markers for each.

## Timeline (local time, Chile)

All times on 2026-08-11 unless noted.

| Time | Event |
|------|-------|
| Morning | Live workshop for ~50 teachers begins. Facilitator prompts participants to interact with Martina. Chatbot returns "Ocurrió un error. Por favor intenta de nuevo" for most requests. |
| 11:19  | Google Cloud logs record `The request failed because billing is disabled for this project` on `coachTurn` Cloud Run service. Attempts to start new instances fail. Symptom to the browser: preflight `OPTIONS` returns 429, no CORS headers → interpreted as CORS failure. |
| 11:29  | Firebase project is upgraded from Spark back to Blaze (billing re-enabled). |
| 11:33  | Confirmed via `gcloud`: `coachTurn` service state = ACTIVE, IAM policy grants `roles/run.invoker` to `allUsers`, all required APIs (Cloud Run, Artifact Registry, Cloud Build, Eventarc) are enabled. Yet all requests still return 429 `no available instance`. |
| 11:35  | Root cause identified via Cloud Run audit logs: `Ready condition status changed to False ... Image '.../gcf-artifacts/...:version_1' not found`. Artifact Registry `gcf-artifacts` repository is confirmed empty. The Spark downgrade purged the Gen2 function images. |
| 11:38  | Redeploy: `firebase deploy --only functions --project summer-chatbot-dev --force`. All function images rebuilt and pushed. Six services updated: `coachTurn`, `mentorChat`, `labChat`, `crisisBranch`, `timerOverride`, `inactivityScan`. |
| 11:38–11:48 | Redeploy succeeds and revisions become `Ready=True` with min-instances=1 forced on `coachTurn`. Requests still return 429 with `content-type: text/html` "Rate exceeded" — this response comes from the Google Frontend, not from Cloud Run, and indicates a persistent billing-throttled state cached at the edge. |
| 11:48  | Edge-cached throttling clears on its own. Preflight OPTIONS now returns 204 with correct `access-control-allow-origin`. Chat flow begins working. |
| ~15:00–17:00 | Chatbot operates. Some conversations succeed end-to-end; others return HTTP 400 intermittently. |
| 17:24  | New error class appears in logs, distinct from earlier CORS/instance issues: `Unhandled error ClientError: [VertexAI.ClientError]: got status: 429 Too Many Requests. {"error":{"code":429,"message":"Resource exhausted...","status":"RESOURCE_EXHAUSTED"}}`. Origin: `runCallA` in `packages/functions/src/coach/callA.ts`. |
| 17:28–17:31 | Log analysis confirms an intermittent pattern: individual requests alternate between 200 and 400, with 400s traceable to Vertex AI 429s propagated by `coachTurn`. |
| ~17:35 | Quota console investigation via `serviceusage.googleapis.com` API. Discovery: `gemini-2.5-flash` (non-TTS) does not appear in the project's per-project quota metrics. Only TTS variants (`gemini-2.5-flash-tts`, `gemini-2.5-flash-lite-tts`, `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-tts`, `gemini-2.5-pro-preview-tts`) expose raisable quotas. Previous quota-increase requests in June 2026 had approved 40 RPM and 60 RPM — but for TTS models not used by the coach. Conclusion: `gemini-2.5-flash` uses Dynamic Shared Quota (DSQ), a Google-managed shared pool with no per-project ceiling to raise. |
| ~18:00 | Code-level mitigation designed: retry-with-jittered-backoff wrapper for Vertex calls. |
| ~18:30 | Deployed. Commit `d9292fa`, revision `coachturn-00018-xic` serving 100% traffic on `summer-chatbot-dev`. |

## Root causes

### Root cause 1 — Spark → Blaze downgrade purges Cloud Functions Gen2 images

Firebase's Spark (free) tier does not support Cloud Functions Gen2. Downgrading a project that
has deployed Gen2 functions **removes the container images from Artifact Registry**
(`southamerica-west1-docker.pkg.dev/<project>/gcf-artifacts/`). The Cloud Run services that back
those functions continue to exist and their IAM/config is preserved, but every cold-start
attempt fails because the referenced image no longer exists in the registry.

At the browser layer this presents as a CORS failure: preflight `OPTIONS` requests return HTTP
429 without `Access-Control-Allow-Origin`, because the request never reaches a running instance.
The Google Frontend surfaces this as `"Rate exceeded"` with `content-type: text/html`, which is
easy to misdiagnose as a rate-limit issue rather than a missing-image issue.

**Diagnostic markers that distinguish this from other 429s:**
- Preflight OPTIONS returns 429 (should be 204)
- `gcloud run services get-iam-policy` shows `allUsers` still has `roles/run.invoker`
- Cloud Run audit log: `Ready condition status changed to False ... Image '.../gcf-artifacts/...:version_1' not found`
- `gcloud artifacts docker images list southamerica-west1-docker.pkg.dev/<project>/gcf-artifacts` returns empty

**Fix:** `firebase deploy --only functions --force --project <project>`. The rebuild repopulates
the registry with fresh images. `--force` is needed to clean up any stale service references
(in our case, `inactivityScan` in `southamerica-west1` that was moved to `southamerica-east1`
in code but not yet reconciled).

**Follow-up gotcha:** even after redeploy succeeds and services become `Ready=True`, the Google
Frontend may hold a billing-throttled state for approximately 15–30 minutes and continue
returning 429 `"Rate exceeded"`. This clears without further action. Unlinking and relinking the
billing account is counterproductive — it resets that timer.

### Root cause 2 — Vertex AI `gemini-2.5-flash` runs on Dynamic Shared Quota

Around mid-2025 Google migrated Gemini 2.5 non-TTS models (`gemini-2.5-flash`, `gemini-2.5-flash-lite`,
`gemini-2.5-pro`) from per-project quotas to Dynamic Shared Quota (DSQ). Under DSQ, throughput
is dynamically allocated from a global pool based on demand pressure, billing tier priority, and
whether the project has purchased Provisioned Throughput. Individual projects have no
raisable per-project quota metric for these models.

The Salvador coach flow uses `gemini-2.5-flash` for both Call A (character response) and Call B
(evaluator), issuing two Vertex requests per user turn. Under sustained multi-user load —
particularly a workshop with dozens of simultaneous participants — DSQ pressure causes Vertex
to return `429 RESOURCE_EXHAUSTED` intermittently. There is no console action that raises this
ceiling. The only mitigations are code-level (retry, batching, prompt trimming, model swap) or
paid (Provisioned Throughput reservation).

**Diagnostic marker that distinguishes this from Root cause 1:**
- Log source: `ClientError: got status: 429 Too Many Requests` originating from function stderr,
  not from Cloud Run platform logs
- Stack trace includes `runCallA` or `runCallB` file paths
- `httpRequest.status = 400` returned to the client (the function catches the 429 and returns
  400 to the callable)

## Fix shipped

**Commit** `d9292fa` — `fix(coach): retry Call A/B on Vertex 429 with jittered backoff`

New module: `packages/functions/src/coach/vertexRetry.ts`

```ts
export async function retryOnQuota<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T>
```

- Retries up to 3 attempts total on: HTTP 429, HTTP 503, `RESOURCE_EXHAUSTED` status,
  `UNAVAILABLE` status, or messages containing "429" / "RESOURCE_EXHAUSTED" / "503" / "UNAVAILABLE"
- Backoff: `250 * 2^attempt` ms + 0–200 ms jitter (first retry ~250–450 ms, second ~750–950 ms)
- Non-retriable errors propagate immediately — this is not a general-purpose retry
- Coverage: `callA.ts` wraps `model.generateContentStream(...)`; `callB.ts` wraps `model.generateContent(...)`
- Tests: `vertexRetry.test.ts` with 6 cases covering success path, retriable errors, non-retriable errors, exhaustion

Deploy: `firebase deploy --only functions:coachTurn --project summer-chatbot-dev`, revision
`coachturn-00018-xic` serving 100% traffic.

**Expected effect:** absorbs transient DSQ bursts (typical clearance within 250–1000 ms). Does
not increase the DSQ ceiling itself. Under sustained multi-user overload the retries also
saturate and the user-visible error remains.

## Options evaluated (implemented and rejected)

### Option A — Retry with jittered backoff on Vertex 429 [IMPLEMENTED]

**What:** Client-side (function-side) retry wrapper as described above.

**Pros:**
- Small, low-risk change with clear semantics
- Absorbs the majority of transient DSQ bursts
- No behavioural change on happy path
- Zero recurring cost
- Backwards-compatible; can be tuned or removed without user-visible effect

**Cons:**
- Does not raise the sustained throughput ceiling
- Adds up to ~1 second of latency to turns that hit 429 (invisible on success, visible on failure)
- Does nothing under sustained overload (workshop with 20+ concurrent users)

**Decision rationale:** the fastest, safest, cheapest improvement. Ships regardless of longer-term direction.

### Option B — Disable Call B (evaluator) entirely via runtime config flag [REJECTED]

**What:** Add a runtime config flag `evaluatorEnabled` (Firestore `config/runtime` doc, 30 s
propagation via existing TTL). When flipped to `false`, skip the Call B fire in
`coachHandler.ts`. Halves Vertex load per turn.

**Pros:**
- Largest immediate throughput gain (~2× DSQ headroom on the input-bound side)
- Existing `runtimeConfig` infrastructure supports it with no new abstractions
- Flippable in seconds without redeploy after initial rollout
- Preserves the character conversation completely

**Cons:**
- Kills the gamification loop that is Martina's core value: emotional matrix bars
  (`intensidadEmocional`, `apertura`, `confianzaEnLaAyuda`) stay at seed values throughout the
  session; tag progress bars never fill; the closing report shows 0 competencies demonstrated
- Removes the primary formative-feedback mechanism — the informe becomes uninformative
- Trainees leave with no signal of how they did

**Decision rationale:** rejected explicitly by product owner. The gamification-alive experience
is what makes Martina distinct; degrading it to zero to protect throughput is an unfavourable trade.

### Option C — Sample Call B (fire only every N-th turn) [DEFERRED]

**What:** Add `evaluatorEveryNTurns: number` (default 1) to runtimeConfig. In `coachHandler`,
skip Call B when `turnNumber % N !== 0`. Set to 2 during heavy workshops.

**Pros:**
- Halves DSQ pressure without killing gamification
- Bars still update; users unlikely to notice slower cadence (matrix uses 0.9/turn decay, so
  the signal integrates over time)
- Flag-gated: can be tuned per workshop
- Low implementation effort (~10 min)

**Cons:**
- Bar updates lag by one turn compared to current behaviour
- Half the turns produce no evaluator data — tag progress and matrix persistence get sparser
- Final informe based on fewer data points → slight loss of precision
- Adds a runtime config surface that the methodological team may not track carefully

**Decision rationale:** viable emergency lever if a live workshop saturates. Deferred until needed.

### Option D — Switch Call B to `gemini-2.5-flash-lite` [DEFERRED]

**What:** Change the model used specifically by Call B to `gemini-2.5-flash-lite` (also on DSQ,
but a less-contended pool globally). Call A remains on `gemini-2.5-flash` to preserve character quality.

**Pros:**
- Different DSQ pool → less contention pressure, more headroom without any prompt changes
- Faster (~30–40% latency reduction on Call B)
- Preserves matrix update cadence — bars still move every turn
- Reversible with a one-line code change

**Cons:**
- Model has weaker instruction-following: JSON schema adherence drops from ~99% to ~95%
- Anti-pattern detection recall drops an estimated 15–25% (subtle toxic positivity, minimization)
- Tag detection recall drops an estimated 10–15%
- Matrix delta sign correctness drops 5–10%
- Untested in this codebase; would need eval fixtures to validate before broad rollout
- Violates the current de facto invariant that all coach flows use `GEMINI_MODEL` constant

**Decision rationale:** promising but needs measurement. Deferred until a fixture-based eval is built.

### Option E — Trim Call B prompt aggressively [DEFERRED]

**What:** Compress the ~3,000-token typical Call B prompt by ~35% via:
- Tighter `formatPendingTags` output (drop verbose `positive_examples`/`negative_examples` from the rendered form or compress them)
- Reformat `MATRIX_EVALUATOR_ADDENDUM` from narrative prose to compact rule tables
- Reduce conversation history from 5 turns to 3
- Compress the static evaluator header and confidence calibration block

**Pros:**
- Same DSQ pressure per turn, but ~50% more turns can fit within DSQ ceiling
- No model change; behavioural risk more predictable than a model swap
- Modular: each section can be trimmed independently

**Cons:**
- Estimated 5–10% recall drop on tag detection due to less anchoring detail
- 10–15% drop in anti-pattern detection sensitivity
- Rules expressed as compact tables often followed less faithfully by Gemini than prose
- Reducing history to 3 turns may miss cumulative progression signals ("you validated
  earlier, so this now counts as +2")
- Requires an ADR + new prompt version (`coach_evaluator_v2`) per §7 of CLAUDE.md
- Prompt changes carry high risk without eval infrastructure

**Decision rationale:** worth doing once eval fixtures exist. Deferred; not urgent.

### Option F — Combine D + E (flash-lite + trimmed prompt) [DEFERRED — "Path 1"]

**What:** Ship both D and E together for a combined 2–3× effective capacity gain on the DSQ dimension.

**Pros:**
- Largest capacity multiplier that does not require paid infrastructure
- Preserves both character quality (Call A untouched) and matrix cadence (Call B still fires every turn)
- Latency improves modestly

**Cons — quantified UX impact per session:**
- Character dialogue: 0% change (Call A untouched)
- Reliability under load: +40–60% improvement (large gain, conditional on load)
- Latency: +10–15% improvement (small consistent gain)
- Matrix bar accuracy: −20 to −25% (delta correct ~80–90% of the time vs. ~95% today)
- Tag detection recall: −20 to −30% (compounding effects of weaker model + less input)
- Anti-pattern detection: −25 to −40% (biggest single quality loss; matters for formative feedback)
- Final informe fairness: −25 to −30% (real competencies more often marked "not demonstrated";
  subtle anti-patterns missed and not surfaced as coaching)

**Weighted UX estimate** (assumes dimension weights: dialogue 40%, reliability 15%, matrix 15%,
tags 10%, latency 10%, informe 10%):
- Under heavy workshop load: **net +3 to +7%** (reliability gains dominate)
- Under mixed use: **net −3 to +1%** (near break-even)
- Under light free-use (< 5 concurrent): **net −6 to −7%** (gamification loss with little reliability to gain)

**Decision rationale:** *Rejected for the current user profile.* The projected user base is
first-time participants who each use the platform once or twice ("no heavy users"), so
concurrent load stays low most of the time. Under that profile, path 1 pays the gamification
tax without capturing the reliability gain that would justify it. Revisit if the population
shifts (recurring cohorts, viral growth, high-concentration launch events).

### Option G — Provisioned Throughput [DEFERRED]

**What:** Purchase Vertex AI Provisioned Throughput (PT), sold in Generative AI Scale Units
(GSUs). Each GSU guarantees a fixed tokens-per-second reservation independent of DSQ pressure.
Pricing is public but changes; napkin estimate for 1 GSU of `gemini-2.5-flash` is on the order
of USD 500–1,000 per month with weekly or monthly minimum commitments.

**Pros:**
- Only mitigation that raises the sustained ceiling
- Predictable capacity independent of Google's global demand
- 1 GSU estimated to support ~10–15 concurrent active users → ~10,000+ MAU headroom
- No code changes; no UX degradation
- DSQ still serves as overflow when the reservation is saturated (not a hard cap)

**Cons:**
- Fixed recurring cost regardless of usage
- Overkill for current user profile
- Minimum commitment period means poor fit for bursty workshop-driven traffic (paying full
  price 25 days a month for capacity used 3–4 days)
- Actual GSU sizing for `gemini-2.5-flash` needs verification against published rates before commit

**Decision rationale:** appropriate at 2,500+ MAU or on the transition to production launch.
Not justified for pilot phase.

## Capacity analysis

### Concurrent capacity (with Option A shipped, no other changes)

Per user active turn: ~2 Vertex requests (Call A + Call B). Typical user cadence during a
session: 2–3 turns/min. Vertex requests per active user: ~4–8 RPM.

Empirical DSQ ceiling observed during the incident: ~10 RPM sustained.

| Concurrent active users | Expected behaviour |
|---|---|
| 1–2 | Fluid, no retries |
| 3–4 | Fluid, occasional retries adding 250–750 ms |
| 5–8 | Frequent retries, 5–10% of turns produce user-visible errors |
| 9–15 | 20–30% failure rate visible to trainees |
| 15+ | Severe degradation |

### Total user-base capacity (self-directed use, no workshops)

Assuming spread of use across a normal day/week, peak-hour concentration factor ~15–20%:

| Monthly Active Users | Behaviour |
|---|---|
| < 300 | Fluid 24/7. Rare 2–3 concurrent peaks. |
| 300–800 | Comfortable. Peaks of 3–5 concurrent, retries invisible. |
| 800–1,500 | Green-yellow. Peaks 5–8 concurrent in evenings, retries perceptible but rare. |
| 1,500–2,500 | Yellow. Peaks 8–12, occasional user-visible errors during evening pressure. |
| 2,500–4,000 | Red-intermittent. Predictable collapse at peak, works at off-hours. |
| > 4,000 | Requires Option G (Provisioned Throughput) or architectural change. |

**Working figure:** the platform sustains ~1,000–1,500 MAU comfortably in free-use mode
without any additional mitigation, given the target profile of first-time participants.

### Workshop capacity (single event)

For a live workshop where all participants interact with Martina within a compressed window,
concurrency dominates and MAU math doesn't apply. Rough absorption capacity by window:

| Interaction window | Approximate people served without severe degradation |
|---|---|
| 30 min | 15–20 |
| 60 min | 30–40 |
| 90 min | 45–55 |
| 2+ hours | 50+ |

**Practical workshop mitigations that require no code changes:**
- Split cohort into 2–3 waves of 15–20, staggered 10 min apart
- Set expectation with facilitator that "if you see an error, wait 5–10 seconds and retry"
- Keep the live monitor query running during the session to see DSQ pressure

## Follow-up items

- Consider building an eval fixture (5–10 gold-standard dialogue-evaluation pairs) so future
  prompt / model changes can be measured rather than guessed. Precondition for Options D, E, F.
- Extend the retry wrapper to the Mentor handler (`mentorHandler.ts`) and to the Layer 2 crisis
  classifier if their 429 rates become non-trivial.
- Track DSQ 429 rate as a Cloud Logging metric with an alert threshold (e.g., > 30 events in 5 min).
- Re-evaluate Option G (Provisioned Throughput) if MAU crosses 2,000 sustained or when
  production launch is scheduled.
- Add a lightweight status page or in-app banner for user-visible messaging when the system
  detects sustained DSQ pressure (e.g., "estamos con alta demanda, tus mensajes pueden tardar").
- Document the diagnostic decision tree ("Vertex 429 vs. Cloud Run 429") in the operational
  runbook so future incidents don't require rediscovery.

## References

- Commit `d9292fa` — retry-on-quota fix
- Deployed revision: `coachturn-00018-xic` (`southamerica-west1`)
- Cloud Run service backing coachTurn: `coachturn-687619759108.southamerica-west1.run.app`
- Vertex AI DSQ documentation: https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429
- ADR-001 — Region strategy (`docs/decisions/001-region-strategy.md`) — the `us-central1`
  region pin for Vertex is what makes `gemini-2.5-flash` DSQ the only quota surface available
- Related debt: `docs/debt/0018-martina-formative-workshop-2026-06-17.md` (previous workshop
  where the anonymous-user flow was hardened)
- Related debt: `docs/debt/0017-callb-fire-and-forget.md` (established the Call B background
  pattern that made Option A's silent-failure guarantee possible)
