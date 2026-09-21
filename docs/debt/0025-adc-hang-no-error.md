---
id: 0025
title: Local admin scripts hang silently when ADC are missing or expired
severity: low
status: open
---

## What was observed

During the Fase 0 smoke test (2026-09-18), running
`scripts/list-rollups.ts` against `summer-chatbot-dev` hung for 90+ seconds with
no output. Root cause: local Application Default Credentials had expired. After
`gcloud auth application-default login`, the script ran in ~19s and printed the
152 rollups.

Every admin-SDK script under `packages/functions/scripts/` has the same failure
mode. The Node process blocks inside `getFirestore().get()` (or an equivalent
read/write) waiting for a token that never arrives; nothing is written to
stdout or stderr and there is no timeout.

## What should be done

Add a shared init helper (e.g. `scripts/lib/adminInit.ts`) that:

1. Calls `initializeApp()` and gets a Firestore handle.
2. Wraps a small "credential warm-up" (a `db.doc("__healthcheck").get()` or a
   `GoogleAuth().getClient()` call) with a 5s timeout.
3. On timeout, throws with a clear message:

   ```
   ADC not available or expired. Run:
     gcloud auth application-default login --account=edmundo@spohr.cl
     gcloud auth application-default set-quota-project summer-chatbot-dev
   ```

Every script under `packages/functions/scripts/` should use this helper instead
of calling `initializeApp()` directly.

## Why low severity

- The scripts are dev-only, run manually.
- Once ADC are refreshed the scripts work correctly.
- The failure is annoying, not dangerous. No production impact.

## Estimated effort

30 min once implemented in one script; ~10 min per additional script for the
migration. All scripts:

- `backfill-analytics-rollups.ts`
- `export-daily-metrics.ts`
- `export-pilot-data.ts`
- `list-rollups.ts`
- `seed-config-runtime.ts`
- `seed-knowledge-base.ts`
- `seed-scenario-02-matias.ts`
- `seed-scenario-03-martina.ts`
- `set-admin.ts`
- `validate-regex-patterns.ts` (does not touch Firestore — skip)

## Context

Deferred from Fase 1 (2026-09-18) to keep that phase's timebox to 5 h. Registered
as its own debt at the user's request.
