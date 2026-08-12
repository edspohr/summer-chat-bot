---
id: "0019"
title: "Call B uses gemini-2.5-flash-lite — model-split invariant break"
severity: low
status: open
created: 2026-08-12
---

## What was done and why

`packages/functions/src/coach/callB.ts` was switched from `GEMINI_MODEL`
(`gemini-2.5-flash`) to a new `CALLB_MODEL` constant pinned to
`gemini-2.5-flash-lite`. Call A (character), Mentor, and the Lab handler still
use `GEMINI_MODEL`.

**Reason:** Vertex Dynamic Shared Quota (DSQ) is per-model, and the 2026-08-11
workshop incident showed the evaluator (Call B — long JSON, high token count)
starving Martina's replies (Call A) during bursts. Moving Call B to the
`flash-lite` DSQ pool decouples the two workloads. See:

- `docs/debt/0017-callb-fire-and-forget.md` (Call B latency + fire-and-forget context)
- `docs/incidents/` — 2026-08-11 DSQ starvation notes
- `memory/project_dsq_gemini_2_5.md` — DSQ has no per-project quota knob

## Consequences

- **Invariant broken.** Prior convention: every coach flow uses `GEMINI_MODEL`.
  New code touching Vertex must consult both `GEMINI_MODEL` and `CALLB_MODEL`
  and pick the right one. There is no lint rule enforcing this.
- **flash-lite has weaker JSON adherence** (~95% vs ~99% for flash).
  `callB.ts` now strips markdown fences and slices to the outermost `{...}`
  before `JSON.parse`. Parse failures still fall back to the empty-output path
  (turn silently skipped, same as the fire-and-forget error branch) but now
  log at `warn` with a 500-char snippet.
- **Evaluator quality drift is possible.** flash-lite is a smaller model.
  No fixture-based eval has been run against Call B prompts (tags + matrix
  addendum). This change should be considered provisional until such an eval
  exists.

## How to revert

One-line change in `packages/functions/src/coach/callB.ts`:

```typescript
import { VERTEX_PROJECT, VERTEX_REGION, GEMINI_MODEL } from "../config/vertex.js";
// ...
const model = vertexAI.getGenerativeModel({
  model: GEMINI_MODEL,
  // ...
});
```

`CALLB_MODEL` in `config/vertex.ts` can remain — it becomes dead code until the
next attempt.

## Proper follow-up

1. Build a fixture-based Call B eval: 20–40 recorded trainee turns with expected
   `evaluated_tags` and `matrixDelta`. Run against both `gemini-2.5-flash` and
   `gemini-2.5-flash-lite`. Compare tag detection recall/precision and matrix
   delta agreement. Only then decide whether flash-lite stays.
2. If flash-lite stays, add a comment on `GEMINI_MODEL` explicitly calling out
   that Call B uses a different constant.
