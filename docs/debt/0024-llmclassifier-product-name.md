---
id: 0024
title: safety/llmClassifier.ts prompt still mentions "Salvador" — deferred until Layer 2 safety fixtures exist
severity: low
status: open
---

## What is deferred

`packages/functions/src/safety/llmClassifier.ts` line 11 currently begins the Layer 2
classifier system prompt with `"You are a safety classifier for a chatbot called Salvador."`

The user-visible product name is **Summer ChatBot** (see the product-name rename that
went in with the Corrección 1 commit of Fase 1). Every user-visible string was updated
to use the shared `PRODUCT_NAME` constant. The Layer 2 classifier prompt was NOT
touched, on purpose.

## Why deferred

Layer 2 is a safety-critical LLM call. Changing its system prompt without safety
fixtures is a false-negative risk we chose not to take on this sprint:

- The classifier decides `S` (real ideation), `D` (frame-break distress), or `N`
  (normal). A change that shifts the decision boundary can leak a real crisis past
  Layer 2 into Layer 1.
- We have no Layer-2 evaluation harness yet. The Fase 2 fixtures cover Call A (Martina)
  and Call B (evaluator matrix), not Layer 2.
- The classifier prompt is never shown to the participant — the drift has zero UX
  impact.

## Resolution path

1. Build a small Layer 2 fixture set (10–20 messages spanning S/D/N with edge cases).
2. Score the current prompt as baseline.
3. Rename `Salvador` → `PRODUCT_NAME` (or the literal current product name) in the
   prompt.
4. Re-score. Any decision change must be reviewed with the clinical team before merge.

Estimated effort once the fixture harness exists: 30 min.

## Related

- debt-0003 (Layer 3 regex clinical validation) — same principle: no changes to
  safety-critical LLM/rule surfaces without a fixture harness and clinical sign-off.
- debt-0018 (workshop shortcuts) — the classifier prompt is one of the strings that
  drifted from clinical review.
