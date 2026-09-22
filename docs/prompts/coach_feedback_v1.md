# coach_feedback_v1

**Purpose**: post-session formative feedback for the trainee. Fires from `packages/functions/src/session/reportGenerator.ts` after the coach session closes (not `crisis_interrupted`) and at least 3 trainee turns exist.

**Runtime source**: `packages/functions/src/prompts/content.ts` — the exported constant `coach_feedback_v1` is the authoritative version; this document mirrors it for the clinical team.

**Output schema**: `FormativeReportContentSchema` in `packages/shared/src/schemas/formative-report.schema.ts`. Validated with Zod before persistence.

**Model config** (from `config/runtime`, defaults in code):
- `responseMimeType: "application/json"`
- `thinkingBudget: 0` (default). Baseline 2026-09-21 comparison on fixture 01 showed `tb=1024` took 12.9s / 894 thinking tokens; `tb=0` took 6.8s / more cues verified (4/4 vs 3/4). Retry-on-`MAX_TOKENS` lowers `tb` further, so raising the default via `config/runtime` is safe.
- `maxOutputTokens: 4096` — holgado.
- `temperature: 0.5` — bounded creativity for the quotes and alternatives.
- Retries via `retryOnQuota` with `timeoutMs: 30_000` (Call B ceiling).

**Placeholders**
- `[SCENARIO_SUMMARY]` — scenario id, character name, initial situation, expected outcome.
- `[SCENARIO_TAGS]` — every OASIS tag definition for this scenario (`tag_id`, `phase`, `definition`, `musts`), so tips can anchor in a real MUST.
- `[SESSION_FACTS]` — trainee turn count, duration, ended reason, `wasResumedAfterCrisis`.
- `[TURN_EVALUATIONS]` — per-turn `tagsObservados` + `antiPatronesDetectados` from `turnos/`. For the model's context only.
- `[MATRIX_TRAJECTORY]` — per-turn `Δintensidad · Δapertura · Δconfianza`. For context only.
- `[CONVERSATION]` — full sanitized transcript, delimited by `<<<CONVERSATION_BEGIN>>>` / `<<<CONVERSATION_END>>>`. Turns that triggered safety (Layer 2/L3), the crisis template response, and any nudge messages are stripped when applicable. Rendered as `Aprendiz: …` / `Martina: …`.

## What v1 does that the pre-committed version did NOT

Rewritten 2026-09-21 (still v1; the pre-rewritten v1 never reached production). Product changed the report from "descriptive mirror" to "coaching tool":

- **Voice is the Mentor of Summer ChatBot**, first person sobria ("noté que...", "te sugiero..."). Not third-person description.
- **Every moment is `kind: "acierto"` or `"oportunidad"`.**
  - `acierto` carries `whyItWorked` (1–2 sentences with the OASIS principle) — NO alternative. Proposing an alternative on top of a success dilutes recognition.
  - `oportunidad` carries `tip: { advice, examplePhrase }`. `examplePhrase` is a ready-to-say line for a teacher in a hallway, in Chilean Spanish. Labeled "ejemplo sugerido" in the UI with a TODO_CLINICAL_VALIDATION note.
- **Balance rules** (enforced by Zod `superRefine`):
  - First moment MUST be `acierto`. If the conversation was weak, the acierto may be small (a chosen pause, a specific word) but must be real and cited.
  - Aciertos ≥ oportunidades.
  - Max 2 oportunidades per report.
- **New fields on the content**:
  - `nextChallenge`: a micro-challenge, concrete and observable, one thing. Persisted on `sessions/{id}.nextChallenge` so the next session's pre-screen shows "Tu desafío de hoy".
  - `mentorQuestion`: written in the participant's first person, prefills the Mentor chat from the "Hablar con el Mentor" button on the report.
- **Normalization without shame**: when the trainee used premature advice, minimization, cascade questioning, or terse replies, the tip frames the impulse as human ("es muy natural querer dar soluciones cuando vemos sufrir a alguien") BEFORE giving the advice. Prohibited: "deberías haber", "el error fue", "fallaste", tone of correction.
- **Anchored tips**: every tip is anchored in the MUSTs of a scenario tag. If the tip touches help resources, the ONLY allowed list is `*4141`, `600 360 7777 opción 2`, `hablemosdetodo.injuv.gob.cl` — matches `packages/web/src/lib/helpResources.ts`.
- **Real-life bridge**: at least one tip closes with a sentence translating the learning to a conversation with a real student.
- **Motivating close** in `synthesis` or `nextChallenge`: practicing again is part of the method; each attempt with Martina can turn out different.
- **Prompt-injection defense**: `[CONVERSATION]` is delimited by markers; anything between them is data, not instructions.

## Non-negotiable constraints (still in force)

- No scores, no percentages, no pass/fail language. Prohibited vocabulary is enumerated in the prompt itself: `puntaje`, `nota`, `%`, `aprobado`, `reprobado`, `deberías haber`, `el error fue`, `fallaste`, `incorrecto`.
- No diagnosis of the trainee.
- Personal disclosures are ignored, not cited.
- Every `quote` is a literal substring of a trainee message. `verifyMoment` (NFC + smart-quote fold + whitespace + case) drops moments that fail; if fewer than 2 survive, one retry with `temperature: 0`; if still fewer, `status: "minimal"` with `skipReason: "moments_unverifiable"`.
- Post-crisis sessions have the trigger turn + template response excluded from the conversation. The report doc carries `wasResumedAfterCrisis: true`.

## Failure paths (unchanged)

| Situation | Result |
|---|---|
| Session state is `crisis_interrupted` (never resumed) | No formative report. UI shows minimal template. |
| Fewer than 3 trainee turns | `status: "minimal"`, `skipReason: "too_short"`. Model NOT called. |
| Model timeout, quota, or parse failure after 1 retry | `status: "failed"` → UI treats as minimal, `skipReason: "generation_failed"`. Never surfaces an error screen. |
| Fewer than 2 moments survive quote verification after 1 retry | `status: "minimal"`, `skipReason: "moments_unverifiable"`. |

## Version history

- v1 (2026-09-21): initial draft written as a descriptive mirror (never deployed).
- v1 (2026-09-21, rewritten same day): coaching tool with aciertos + oportunidades + nextChallenge + mentorQuestion; Mentor voice. Not deployed yet.

## Prompt body

See `packages/functions/src/prompts/content.ts::coach_feedback_v1`. Body is in Spanish (per §10, the participant-facing content is Chilean Spanish and this prompt speaks in the Mentor's voice — the participant is Chilean).
