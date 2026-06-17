---
id: "0017"
title: "Call B runs fire-and-forget — matrix bars lag one turn behind"
severity: medium
status: open
created: 2026-06-17
---

## What was done and why

Call B (the OASIS tag evaluator) was changed from `Promise.all([callA, callB])` to a
fire-and-forget pattern: Call A (Martina's reply) is awaited synchronously (~2s), then
the response is returned to the client immediately. Call B continues running in the Cloud
Functions container in the background and writes to Firestore when it finishes (~2-3s later).

**Reason:** In production, Call B with 8 tags + MATRIX_EVALUATOR_ADDENDUM was taking
12–13 seconds. The Cloud Function timeout was 60s (later raised to 180s), but the
perceived latency was the bottleneck — teachers had to wait 12-13s between every message,
which killed the conversational flow. Fire-and-forget reduces perceived latency to ~2s.

## Consequences

- **Matrix bars update one turn behind.** The `estadoMatriz` returned in the callable
  response is the *pre-turn* state. The bars animate when the client re-reads the matrix
  from the next turn's response (or a Firestore listener, if one is added later).
  In practice: bars move, but with a ~2-3s delay after the reply appears.

- **Tag progress lags one turn.** `tagUpdates: 0` is always returned; the actual tag
  accumulation happens async. The `tag_progress` Firestore listener in the client still
  fires correctly because `accumulateTags` writes to Firestore — it just fires a few
  seconds after the reply.

- **On container recycling, the turn's evaluation is lost.** If Cloud Functions GCs the
  container before Call B resolves (very rare — containers stay warm for several minutes
  after a request), that turn's tags and matrix delta are silently dropped. No error is
  surfaced to the user. Acceptable for the formative demo; not acceptable for a
  production audit trail.

- **Crisis path is unaffected.** Safety pipeline (Layer 3 regex + Layer 2 LLM classifier)
  runs synchronously before Call B fires. If a crisis is detected, the function returns
  immediately with the crisis template and never reaches the fire-and-forget block.

## How to revert

In `coachHandler.ts`, replace the fire-and-forget block with:

```typescript
const [callAResult, callBResult] = await Promise.all([
  runCallA(callAInput, modo),
  modo === "escenario" ? runCallB(callBInput, true) : runCallB(callBInput, false),
]);
```

And restore `estadoMatriz: newMatrix ?? currentMatrix` and `tagUpdates: callBResult.evaluated_tags.length`
in the return statements.

## Proper fix (future)

Option A — **Gemini Flash thinking off + prompt compression**: reduce the evaluator prompt
size by splitting tag evaluation and matrix evaluation into separate smaller calls, each
under ~800 tokens. Target: Call B under 3s.

Option B — **Real-time Firestore listener on the client**: the UI already has the
infrastructure (tag_progress listener). Add a `sessions/{id}` listener for `estadoMatriz`
so bars update the moment Firestore is written, regardless of when the callable responds.
This makes the lag invisible to the user.

Option B is lower risk and doesn't require prompt changes.
