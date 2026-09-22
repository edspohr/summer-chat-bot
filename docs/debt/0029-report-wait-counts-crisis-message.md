# 0029 — Report generator waits 4s for a Call B turno that will never arrive on resumed sessions

**Severity**: low
**Status**: open
**Registered**: 2026-09-21 (post-deploy log review, Sprint 1 close)

## Symptom

On sessions resumed after crisis, `generateFormativeReportForSession` sleeps
its full 4s "wait for last turno" grace window every time. Logs show the
timeout firing, not an early resolution.

## Cause

The wait decision compares `messages` (user role) count against
`sessions/{id}/turnos` count. If `messagesUser - turnos === 1`, the generator
assumes Call B is still writing the last turno and waits up to 4s.

On resumed sessions the extra user message is the one that **triggered the
crisis** (`safetyLayerTriggered=true`). That message bypasses Call B by
design — no turno is ever written for it. The delta is 1 forever, so the
generator always waits the full window and never gets a real signal.

## Fix

In the wait-decision predicate, exclude messages with
`safetyLayerTriggered === true` from the user-message count before diffing
against `turnos`. Then a resumed session with one crisis turn behaves like
a normal session: delta is 0, no wait.

Location: `packages/functions/src/session/reportGenerator.ts`
(the `waitForLastTurno` helper — search for the 4000ms constant).

## Test to add

`reportGeneratorCore.test.ts`: a fixture where messages = 4 (last one is
safetyLayerTriggered) and turnos = 3 → wait predicate returns false.

## Why low severity

Cost is ~4s of latency on the fraction of sessions that resumed after crisis
AND generate a report. Not a correctness bug — the report still generates
correctly. But it's a wasted 4s on every affected session and misleads any
future latency budget analysis.
