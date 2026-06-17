---
id: 0013
title: Cloud Functions runtime nodejs20 is deprecated — upgrade to nodejs22 before 2026-10-30
severity: high
status: open
deadline: 2026-10-30
---

## What was done

Cloud Functions are deployed with `"runtime": "nodejs20"` in `firebase.json`. The local
development machine runs Node 22. Every `pnpm` command during the Latency Lab sprint
produced the warning:

```
WARN Unsupported engine: wanted: {"node":"20"} (current: {"node":"v22.19.0"})
```

Google will decommission the Node.js 20 runtime for Cloud Functions on **2026-10-30**.
Functions on nodejs20 will stop running after that date.

## Why this is high severity

After 2026-10-30, any deployed function on nodejs20 becomes unavailable. This is not
a performance issue — it is a hard deadline that kills the product if missed.

The local/production engine mismatch also means behavior diverges: any Node 22
API used inadvertently in local dev will fail silently in production.

## What should be done

1. Update `firebase.json` → `"runtime": "nodejs22"`
2. Update `packages/functions/package.json` → `"engines": { "node": "22" }`
3. Update `packages/shared/package.json` and `packages/web/package.json` engines fields if present
4. Upgrade `firebase-functions` to the latest version (verify Node 22 support in release notes)
5. Run `pnpm install` to pick up any peer dependency updates
6. Run `pnpm typecheck && pnpm test` — confirm clean
7. Deploy to `summer-chatbot-dev` and smoke-test all three functions: `mentorChat`, `coachTurn`, `labChat`
8. Deploy to `summer-chatbot-prod` after dev validation

## Estimated effort

0.5 day — mostly verification. The runtime bump itself is a two-line change.
Risk is low: Node 22 is LTS, and the codebase uses no Node-version-specific APIs.

## Context

Discovered during Latency Lab deploy sprint (2026-05-12). Not upgraded during that sprint
to avoid scope creep on the safety-critical deploy. Deadline is firm — calendar a reminder
for 2026-09 to leave a buffer before the 2026-10-30 cutoff.
