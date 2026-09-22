---
id: 0013
title: Cloud Functions runtime nodejs20 is deprecated — upgrade to nodejs22 before 2026-10-30
severity: high
status: resolved (2026-09-18)
deadline: 2026-10-30
---

## What was done

Cloud Functions were deployed with `"runtime": "nodejs20"` in `firebase.json`. The local
development machine runs Node 22. Every `pnpm` command produced the warning:

```
WARN Unsupported engine: wanted: {"node":"20"} (current: {"node":"v22.19.0"})
```

Google will decommission the Node.js 20 runtime for Cloud Functions on **2026-10-30**.
Functions on nodejs20 will stop running after that date.

## Resolution

Runtime and admin/functions SDKs bumped in a single commit on
`feat/formative-sprint1`:

- `firebase.json` → `"runtime": "nodejs22"`
- `packages/functions/package.json` → `"engines": { "node": "22" }`, `@types/node` → `~22.10.0`
- `firebase-functions` `^6.0.0` → `^7.4.0` (installed 7.4.0)
- `firebase-admin` `^12.0.0` → `^14.4.0` (installed 14.4.0)

`firebase-admin@14` requires Node 22+, so the runtime bump and the admin bump are
coupled by force. `firebase-functions@7` drops Node 16, removed `functions.config()`
(not used here — we use `defineSecret`), and renamed the v1 `Event` type
(we import only from `firebase-functions/v2/*`, so no impact). No source changes
were required in `packages/functions/src/`.

Transitive majors picked up alongside the two authorized bumps (all internal
to firebase-admin/firebase-functions dependency trees):

- `@google-cloud/firestore` 7 → 9
- `@google-cloud/storage` 7 → 8
- `@google-cloud/paginator|projectify|promisify` 4-5 → 6-7
- `@firebase/database-compat` 1 → 2
- `@types/express` 4 → 5, `@types/express-serve-static-core` 4 → 5, `@types/serve-static` 1 → 2

`pnpm typecheck` and `pnpm test` (114 tests) pass. Vendor-shared predeploy
(`file:../shared` pattern from debt-0014) still resolves.

## Deploy + smoke test (2026-09-18)

Deployed to `summer-chatbot-dev` with
`FIREBASE_FUNCTIONS_DISCOVERY_OUTPUT_PATH=true firebase deploy --only functions --project summer-chatbot-dev`.
(The env var is required on this environment — see debt-0023.) Cleanup of one
stale `inactivityScan(southamerica-west1)` phantom done via `gcloud functions delete`.

Smoke test result: 7 of 8 PASS, 1 SKIP (labChat via UI — user was on a non-admin
account and the `/lab` gate correctly redirected). Zero WARN-or-above logs in Cloud
Run during the test.

- mentorChat: streamed OASIS reply, `promptVersion: "mentor_v1"` persisted.
- coachTurn happy: Martina in character, matrix moved on turn 2 (debt-0017 lag).
- coachTurn unauthenticated: HTTP 401 UNAUTHENTICATED — HttpsError contract intact
  across the firebase-functions v6→v7 bump.
- crisisBranch: `"quiero terminar con todo"` → template, `state: "crisis_interrupted"`,
  no auto-resume.
- inactivityScan: force-run OK; no scan lines because `inactivityEnabled` is false
  in dev (turned on for real in Fase 1).
- analyticsRollupDaily: force-run OK, cold-start 2.5s, wrote `2026-09-17` rollup.
- list-rollups.ts (admin SDK outside Cloud Functions): 152 rollups listed, no
  stack traces. Confirmed `firebase-admin@14` + `@google-cloud/firestore@9` work
  fine from local scripts under Node 22.

## Prod deploy

Still gated. Do not touch `summer-chatbot-prod` until after the Fase 1..4 sprint
lands in dev. The 2026-10-30 cutoff has a comfortable buffer.

## Context

Discovered during Latency Lab deploy sprint (2026-05-12). Not upgraded during that
sprint to avoid scope creep on the safety-critical deploy. Deadline is firm.
Implemented and dev-validated 2026-09-18 during the formative sprint 1.

## Context

Discovered during Latency Lab deploy sprint (2026-05-12). Not upgraded during that
sprint to avoid scope creep on the safety-critical deploy. Deadline is firm.
Implemented 2026-09-18 during the formative sprint 1.
