---
id: "0021"
title: "Vitest hangs on any test file that imports src/config/firebase.ts (matrixEngine.test.ts, timerService.test.ts)"
severity: medium
status: open
created: 2026-09-02
---

## What was found

`pnpm --filter @salvador/functions test` runs the whole suite and appears to
stall silently on macOS with the current toolchain. A per-file scan
(2026-09-02) narrowed it down. Under Node 20.19 + vitest 2.1.9 + pnpm 10.33,
each test file was invoked in its own `vitest run` with a 60s cap:

| File | Result |
|---|---|
| `src/analytics/aggregators.test.ts` | ✓ 12 passed |
| `src/coach/matrixEngine.test.ts` | **hang → 60s TIMEOUT** |
| `src/coach/parallelCalls.test.ts` | ✓ 3 passed |
| `src/coach/vertexRetry.test.ts` | ✓ 6 passed |
| `src/config/runtimeConfig.test.ts` | ✓ 5 passed |
| `src/safety/safetyPipeline.test.ts` | ✓ 10 passed |
| `src/safety/regexPreempt.test.ts` | ✓ 63 passed |
| `src/session/timerService.test.ts` | **hang → 60s TIMEOUT** |

The two hangs are the exact two test files whose module-under-test imports
`../config/firebase.js`:

- [`packages/functions/src/coach/matrixEngine.ts`](../../packages/functions/src/coach/matrixEngine.ts) L3: `import { db } from "../config/firebase.js";`
- [`packages/functions/src/session/timerService.ts`](../../packages/functions/src/session/timerService.ts) L3: `import { db } from "../config/firebase.js";`

Every other test file imports only pure helpers (or mocks `@google-cloud/vertexai`),
and each of those passes in a few hundred ms.

## Likely cause

[`packages/functions/src/config/firebase.ts`](../../packages/functions/src/config/firebase.ts) has an **unconditional side effect at
module load**:

```ts
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = initializeApp();      // runs at import time
export const db = getFirestore(app);
```

When `matrixEngine.test.ts` imports `applyMatrixDelta`, ESM has to evaluate the
entire `matrixEngine` module, which pulls in `firebase.ts`, which calls
`initializeApp()` — the admin SDK then blocks trying to resolve default
credentials / metadata server, and holds an open handle that keeps the vitest
worker from exiting. Vitest waits for the pool to drain; the pool never
drains; the reporter sits on the "RUN" banner forever.

Corroborating signals:

- Both hung files hold zero test-level side effects; the tests are pure
  computation (`applyMatrixDelta`, `computeTimerState`). The hang is at module
  init, not inside a test.
- The pure-computation test files (`aggregators`, `parallelCalls`, `vertexRetry`,
  `regexPreempt`, `safetyPipeline`, `runtimeConfig`) never touch `firebase.ts`
  and exit cleanly.
- Under Node 22 the whole suite (including passing files) also hangs from the
  first firebase-importing file onwards — same mechanism, different attribution
  in `ps`.

## Consequences

- `pnpm --filter @salvador/functions test` never completes locally.
- CI (if any is added) will time out at whatever suite-level cap is set.
- Coverage for the matrix engine and timer service is not actually validated
  when devs run the suite; they see a hung terminal and Ctrl-C.
- The hang masks any real test failures in the two affected files.

## How to fix (proposed, separate prompt)

Any one of these unblocks the suite; pick per the team's preference:

1. **Lazy-init the SDK** — export `getDb()` (or a proxy) from `config/firebase.ts`
   and call it inside functions that need Firestore. Nothing runs at import
   time. Zero test setup needed.
2. **Split the pure math out** — move `applyMatrixDelta` and `computeTimerState`
   into a `-pure.ts` sibling with no firebase-admin dependency; keep the
   firestore-writing wrappers (`persistMatrixUpdate`, `readMatrixState`,
   `startTimer`) in the current file. Tests import from the pure module.
3. **Point tests at the emulator** — add `setupFiles` that sets
   `FIRESTORE_EMULATOR_HOST` before any import; requires the emulator to be
   running for `pnpm test`.

(1) is the smallest change and matches how the rest of the codebase already
works (Cloud Functions handlers accept the SDK at call time). Owner: TBD.
