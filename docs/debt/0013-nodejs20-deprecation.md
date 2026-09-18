---
id: 0013
title: Cloud Functions runtime nodejs20 is deprecated — upgrade to nodejs22 before 2026-10-30
severity: high
status: implemented — awaiting manual deploy to dev
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

## Pending

- Manual deploy to `summer-chatbot-dev` and smoke test (see PR description for
  the exact command list). Do not deploy to `summer-chatbot-prod` before dev
  validation and buffer time before the 2026-10-30 cutoff.

## Context

Discovered during Latency Lab deploy sprint (2026-05-12). Not upgraded during that
sprint to avoid scope creep on the safety-critical deploy. Deadline is firm.
Implemented 2026-09-18 during the formative sprint 1.
