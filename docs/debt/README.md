# Technical Debt Register

_Last updated: 2026-06-12 (0015, 0016 added — engine upgrade)_

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

> **Debt 0003 is the highest urgency**: Layer 3 regex patterns are the first line of defense
> for real crisis detection. Without clinical validation, there is risk of false negatives
> with safety consequences. Do not deploy to production without a co-design session with
> the Fundación Summer clinical team.
>
> **Debt 0006 next step**: run `pnpm --filter @salvador/functions seed:no-embeddings` against
> the emulator to verify the 22 chunks land correctly, then `firebase deploy --only firestore:indexes`
> before enabling RAG in production.
>
> **Debt 0010** (lab_sessions Firestore rules): ~~open~~ **implemented 2026-05-12** — rules written and
> emulator-tested (11/11). Deploy with `firebase deploy --only firestore:rules --project summer-chatbot-dev`.
