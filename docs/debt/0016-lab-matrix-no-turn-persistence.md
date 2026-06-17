# 0016 — Latency Lab matrix state persisted to session doc but not turns subcollection

**Date**: 2026-06-12  
**Severity**: Low — audit gap, not a functional issue

## What was deferred

In `labChatHandler.ts`, when the matrix evaluator fires (coach_context + escenario),
the resulting `estadoMatriz` is persisted to `lab_sessions/{sessionId}` (session doc
only). It is **not** written to a `turnos/` subcollection with per-turn delta audit.

In production `coachHandler.ts`, `persistMatrixUpdate` writes both the session state
AND a turn record to `sessions/{id}/turnos/{id}`.

## Why we did it this way

The Lab is a developer testing tool, not a training session. The turn-level audit is
primarily for Fundación Summer session review and for the post-session report generator.
Adding the full `persistMatrixUpdate` call to the Lab handler would also require
generating synthetic `turnoId`s and `rol` fields not present in the lab's data model.

## What the right solution looks like

Either: (a) reuse `persistMatrixUpdate` from matrixEngine.ts in the lab handler with a
`lab_sessions/{id}/turnos/` path, or (b) add a `latenciaMs` field to the lab message
Firestore doc (which already gets written) to capture per-turn delta alongside the
existing metrics.
