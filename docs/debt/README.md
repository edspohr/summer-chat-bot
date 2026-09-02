# Technical Debt Register

_Last updated: 2026-09-02 (0021 added — vitest hangs on firebase-admin init at import)_

| ID | Title | Severity | Status |
|---|---|---|---|
| [0001](0001-embedding-sync.md) | Embedding sync — one-time seed doesn't detect modified chunks | medium | open |
| [0002](0002-vector-search-scale.md) | Firestore vector search untested at scale (>500 chunks) | medium | open |
| [0003](0003-safety-regex-clinical-validation.md) | Layer 3 regex patterns pending clinical co-validation with Fundación Summer | **high** | open — production blocker |
| [0004](0004-report-generation-stub.md) | reportGenerator.ts is a stub — real logic depends on pending clinical decisions | medium | open |
| [0005](0005-java-path-emulators.md) | Java not in system PATH — Firestore emulator requires manual PATH export | low | open |
| [0006](0006-knowledge-base-not-seeded.md) | Knowledge base not seeded — Mentor RAG returns empty until Firestore is populated | **high** | partially-resolved — seed script done, needs emulator run + index deploy |
| [0007](0007-pricing-constants.md) | Pricing constants hardcoded to May 2026 rates — verify before prod launch | low | open |
| [0008](0008-first-token-latency.md) | firstTokenLatencyMs is approximated via stream iterator timing, not native SDK | low | open |
| [0009](0009-promptbuilder-stub-divergence.md) | labChatHandler uses inline prompt assembly — diverges from stub promptBuilder.ts | medium | open |
| [0010](0010-lab-sessions-firestore-rules.md) | lab_sessions Firestore collection has no security rules | **high** | implemented |
| [0011](0011-matias-scenario-missing.md) | Scenario 02 (Matías) has no definition document or Firestore seed data | medium | open |
| [0012](0012-docs-project-naming.md) | docs/03_arquitectura_tecnica.md references incorrect Firebase project names | low | open |
| [0013](0013-nodejs20-deprecation.md) | Cloud Functions runtime nodejs20 deprecated — upgrade to nodejs22 before 2026-10-30 | **high** | open — deadline 2026-10-30 |
| [0014](0014-pnpm-workspace-cloudbuild.md) | pnpm workspace:* incompatible with Cloud Build npm — resolved via file:../shared | medium | implemented |
| [0015](0015-matrix-no-sse-streaming.md) | Matrix state delivered via callable response, not real-time Firestore listener | medium | open |
| [0016](0016-lab-matrix-no-turn-persistence.md) | Lab matrix state not persisted to turns subcollection (session doc only) | low | open |
| [0017](0017-callb-fire-and-forget.md) | Call B fire-and-forget — matrix bars lag one turn; turn evaluation lost on container GC | medium | open |
| [0018](0018-martina-formative-workshop-2026-06-17.md) | Formative workshop build shortcuts — anon auth, prompt sync, clinical validation gap | medium | open |
| [0019](0019-callb-model-split.md) | Call B uses `gemini-2.5-flash-lite` — model-split invariant break | low | open |
| [0020](0020-est01-finishreason-observability.md) | Call A `finishReason` logged as plain text; no client-side fallback for truncated Martina | medium | open |
| [0021](0021-vitest-firebase-admin-init-hang.md) | Vitest hangs on any test file that imports `src/config/firebase.ts` (matrixEngine, timerService) | medium | open |

> **Debt 0003 is the highest urgency**: Layer 3 regex patterns are the first line of defense
> for real crisis detection. Without clinical validation, there is risk of false negatives
> with safety consequences. Do not deploy to production without a co-design session with
> the Fundación Summer clinical team.
>
> **Debt 0017**: Call B runs fire-and-forget to reduce perceived latency from 13s to ~2s.
> Matrix bars update one turn behind. On container GC (rare), a turn's evaluation is silently
> lost. Revert instructions in the debt doc. Proper fix: Firestore listener on `estadoMatriz`
> (Option B in 0017) — low risk, no prompt changes needed.
>
> **Debt 0018**: records all shortcuts from the 2026-06-17 formative workshop sprint.
> Most urgent follow-up: sync `docs/prompts/coach_conversational_v1.md` with `content.ts`,
> and run a delta review of the new `MATRIX_EVALUATOR_ADDENDUM` with the clinical team.
>
> **Debt 0006 next step**: run `pnpm --filter @salvador/functions seed:no-embeddings` against
> the emulator to verify the 22 chunks land correctly, then `firebase deploy --only firestore:indexes`
> before enabling RAG in production.
