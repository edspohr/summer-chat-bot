# 0032 — Analytics rollup: dead fields, frozen snapshots, client reads whole collection

**Severity**: low
**Status**: open
**Registered**: 2026-11-03 (analytics v2 rework, branch `feat/analytics-v2`)

## Findings from the 2026-11-03 audit

Rollups matched live `sessions` day by day (counts and end states, 90 days),
so the pipeline is correct. What remains are definitional gaps:

1. **`abandoned` is never written.** `SessionStateSchema` declares it but no
   code path sets it. The `ended.abandoned` bucket is always 0. Sessions that
   never close stay `active` forever; rollup v2 now counts them in
   `ended.active` ("Sin cerrar" in the UI), which folds `abandoned` in.
2. **`rateLimitedRejections` is never populated.** Always 0 in every rollup.
3. **Rollups are frozen at 04:00 D+1.** A session that changes state later
   (e.g. a report generated the next morning, a crisis branch picked late)
   is never reflected. Re-running the backfill fixes it on demand.
4. **Missing day 2026-09-13.** The scheduler produced no doc that day (zero
   sessions, so no numeric impact). There is no alert when the job fails;
   the dashboard now flags missing days in the window.
5. **The dashboard reads the whole `analytics_rollups` collection** (~200 small
   docs, one per day). Fine for years at this size; switch to a
   `where("date", ">=", ...)` query if it ever grows past a few thousand.
6. **Mentor sessions share the `sessions` collection** with
   `scenarioId: "mentor"`. Rollup v2 tags them `modo: null` and the UI counts
   them apart; any other consumer of rollups must do the same.
7. **Medians over multi-day windows are approximate** (weighted average of
   daily medians). Exact values need per-session durations, which rollups do
   not store by design.
8. **Safety activations without a pause.** On 2026-10-01, 2 sessions carry
   `safetyLayerTriggered` messages but no `crisis_interrupted` state.
   Probably L1 tags that L2 classified as N. Worth confirming it is the
   intended semantics before showing "sesiones con activación" to Summer.

## Fix path

- (1) decide whether to write `abandoned` from `inactivityScan` for sessions
  with no user turns, or drop the state from the schema.
- (3)(4) Phase 3 of the analytics proposal: alert on missing rollup +
  "recalcular hoy" admin action.
