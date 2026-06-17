---
id: 0007
title: Pricing constants hardcoded to May 2026 rates
severity: low
status: open
---

## What was done

Gemini 2.5 Flash pricing constants are hardcoded in `packages/functions/src/config/pricing.ts`
with `validatedAt: "2026-05-12"`. Values used:
- Input: $0.075 / 1M tokens
- Output: $0.30 / 1M tokens

## Why

The Latency Lab needed cost estimates at build time. Google's pricing API is not
programmatically queryable, and pricing changes are infrequent. A hardcoded constant
with a validation date is the right trade-off for a dev tool.

## What should be done

Re-verify pricing at:
1. Before production launch — if pricing has changed, update constants and add a new debt entry.
2. Any time the Gemini model version changes.
3. Quarterly thereafter.

To update: edit `packages/functions/src/config/pricing.ts`, change `validatedAt`,
and update this entry's status to `in-progress` while verifying.

## Estimated effort

30 minutes to verify and update.

## Context

Google publishes pricing at https://cloud.google.com/vertex-ai/generative-ai/pricing.
The Latency Lab cost estimates are informational only — they are not billed directly
from this constant. Billing comes from Vertex AI usage. This constant is for display
purposes and internal cost awareness.
