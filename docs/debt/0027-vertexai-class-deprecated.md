---
id: 0027
title: `@google-cloud/vertexai` VertexAI class deprecated (kill date 2026-06-24, past)
severity: high
status: open
---

## What is broken

Every Call A / Call B / Layer 2 classifier / Latency Lab / judge invocation
in `packages/functions/**` prints the deprecation warning:

```
VertexAI class is deprecated and will be removed by June 24, 2026.
```

The **removal date has already passed** (today is after 2026-06-24). Google
has not yet flipped the switch, but the SDK is unsupported. The successor
is `@google/genai` — a different package, different API surface, different
auth path.

## Why high severity

- The SDK can be removed by Google at any point after the deprecation
  window closes; the log warning has been the only heads-up.
- Every Vertex call in the codebase depends on this class:
  `callA.ts`, `callB.ts`, `safety/llmClassifier.ts`, `lab/labChatHandler.ts`,
  `scripts/eval/run.ts` (judge wiring), the seed script's embeddings.
- Removal → total Coach + Mentor + Lab outage, no fallback.

## What should be done

Group with **Fase 3 (model strategy)**, since the migration and the
Gemini 3 model evaluation touch the same layer:

1. Replace `new VertexAI({...})` + `getGenerativeModel({...})` with the
   `@google/genai` GoogleGenAI constructor.
2. Rewire streaming (`generateContentStream`) and one-shot
   (`generateContent`) call sites — API shape and options names differ.
3. Confirm `thinkingConfig: { thinkingBudget: 0 }` still works on the new
   SDK (or find the new equivalent) — Call A relies on it (CLAUDE.md §12)
   and the judge just started to.
4. Keep `us-central1` region pinning (ADR-001) and the retry-with-timeout
   wrapper (`vertexRetry.ts`) intact.
5. Run the Fase 2 baseline before and after — Martina's replies and Call
   B's evaluated_tags must not shift materially at the SDK boundary.

## Not to be done piecemeal

Migrating one call at a time leaves the codebase running two Vertex SDKs
side by side, which doubles auth surface and doubles the deprecation
warning noise. Migrate everything in one branch, one commit, with the
Fase 3 model swap.

## Discovered

2026-09-21 during Fase 2 baseline v0 review. Owner had already noticed
the warning in earlier runs; this doc formalises the deuda.
