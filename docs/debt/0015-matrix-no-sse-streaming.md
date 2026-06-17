# 0015 — Matrix state delivered via callable response, not real-time Firestore listener

**Date**: 2026-06-12  
**Severity**: Medium — affects perceived responsiveness of the matrix widget

## What was deferred

The emotional matrix widget (`EmotionalMatrix.tsx`) updates when `coachTurn` returns,
not in real-time. The matrix is piggybacked on the existing callable response shape
(`estadoMatriz` field). This means the trainee sees the matrix change after the full
round-trip completes (character call + evaluator call + Firestore write).

## Why we did it this way

The existing architecture uses callable functions, not SSE or WebSockets. Adding a
Firestore real-time listener for `estadoMatriz` would require a separate listener per
session, increasing Firestore read costs and adding client complexity. Given that the
matrix update is already tied to the turn boundary (the character reply), the perceived
latency is the same from the user's perspective.

## What the right solution looks like

Option A: Write `estadoMatriz` to the session doc after each turn and add a Firestore
`onSnapshot` listener in `useCoachSession` — similar to how `useTagProgress` already
works. The UI would update immediately when the evaluator finishes, even before the
character response renders (if the evaluator is faster).

Option B: True SSE delivery where the matrix delta arrives as a separate SSE event
before the character response is fully streamed. Requires SSE infrastructure (debt 0008).

## Risk

Low. The matrix update lag is bounded by the max(callA, callB) latency — typically
under 2 seconds. The trainee reads Martina's reply first, then processes the matrix
update, which is the correct pedagogical sequence.
