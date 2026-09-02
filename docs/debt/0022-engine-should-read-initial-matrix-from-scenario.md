---
id: "0022"
title: "Engine should read initial matrix state from the scenario document (not a per-scenario hard-coded map)"
severity: medium
status: open
created: 2026-09-02
links: [PRO-07]
---

## What was done and why

Before this debt entry existed, three sources disagreed on scenario_03
Martina's initial emotional-matrix values:

- `INITIAL_ESTADO_MATRIZ` in [`packages/functions/src/coach/matrixConstants.ts`](../../packages/functions/src/coach/matrixConstants.ts) — 6 / 5 / 4
  (engine runtime fallback used by [`readMatrixState`](../../packages/functions/src/coach/matrixEngine.ts) via
  [coachHandler.ts:231](../../packages/functions/src/coach/coachHandler.ts))
- The seed scenario document written by
  [`scripts/seed-scenario-03-martina.ts`](../../packages/functions/scripts/seed-scenario-03-martina.ts) — 6 / 4 / 3
- `INITIAL_MATRIX` in `packages/shared/src/types/index.ts` — 6 / 4 / 3
  (consumed by [`useCoachSession`](../../packages/web/src/hooks/useCoachSession.ts) to seed the client bars before Call B lands)

Task-1 (2026-09-02) picked Option A — the engine wins — and aligned every
consumer on **6 / 5 / 4**:

1. New canonical source: [`packages/shared/src/oasis/initialMatrix.ts`](../../packages/shared/src/oasis/initialMatrix.ts)
   exporting `MARTINA_INITIAL_MATRIX` and `initialMatrixFor(scenarioId)`.
2. `matrixConstants.INITIAL_ESTADO_MATRIZ` re-exports it.
3. Seed doc, Session Report, Coach bars, Lab prompt scaffold and closing-data
   export all read from the shared map.
4. CLAUDE.md §12 updated to reflect reality + document the source of truth.

## Consequences of the current shape

- **The scenario document's `emotionalStateVariables.*.initial` field is
  decorative.** Editing it in Firestore does nothing at runtime; the engine
  falls back to the constant when `estadoMatriz` is absent. This is
  surprising and will trip up whoever tries to tune Martina later.
- **Adding a second scenario means a code change.** PRO-07 (scenario_02
  Matías) will need its initial matrix registered in
  `INITIAL_MATRIX_BY_SCENARIO`, not just a new Firestore doc.
- **Historical sessions were tracked with 6 / 5 / 4.** If the clinical team
  later confirms 6 / 4 / 3 was the intended starting point for Martina, the
  constant AND the seed AND the shared map must change together — and the
  fix does NOT retroactively change past sessions' `estadoMatriz`, which
  are already persisted as absolute values (not deltas from initial).

## Proposed fix (separate prompt, gated on PRO-07)

Teach the engine to prefer the scenario document's initials when present:

1. Extend the scenario schema (already has `emotionalStateVariables`) so it
   is the canonical, editable initial state. Add the two engine booleans
   (`pisoIntensidadActivo`, `derivacionAcordada`) if we want them
   customisable, or hard-code them per scenario type.
2. In [`sessionManager.createSession`](../../packages/functions/src/session/sessionManager.ts), stamp `estadoMatriz` on the doc at
   creation time from the scenario the session is bound to. This makes the
   session immutable against later scenario edits (audit-friendly).
3. Remove `INITIAL_MATRIX_BY_SCENARIO` from shared; keep only the type.
4. Analytics `matrixMoved()` in [`aggregators.ts`](../../packages/functions/src/analytics/aggregators.ts) must switch to
   `session.estadoMatriz vs. session.estadoMatrizInitial` (new field) instead
   of comparing against the constant, so re-running rollups after a scenario
   edit produces a coherent picture.

Gate this on PRO-07 landing — before Matías exists there is no forcing
function and doing it now would be premature. Ties to the observability
work in [debt/0020](0020-est01-finishreason-observability.md) (structured
per-session facts on the message doc) and to the closing-data export
(the CSV `*_initial` columns become per-session too, not per-scenario).

Owner: TBD. Depends on: PRO-07.
