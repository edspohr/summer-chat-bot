---
id: 0009
title: labChatHandler uses inline prompt assembly instead of promptBuilder.ts
severity: medium
status: open
---

## What was done

`packages/functions/src/lab/labChatHandler.ts` implements prompt assembly via a private
`buildMentorPrompt`, `buildCoachRawPrompt`, and `buildCoachContextPrompt` family of functions
rather than calling `promptBuilder.ts`.

This was intentional: `promptBuilder.ts` is a Phase 0 stub that returns empty strings
for all three functions (`buildMentorPrompt`, `buildCoachCallAPrompt`, `buildCoachCallBPrompt`).
Depending on the stub would have caused the lab to produce empty prompts silently.

The private functions in `labChatHandler.ts` mirror the logic already implemented inline
in `mentorHandler.ts` and `callA.ts`.

## Why

`promptBuilder.ts` was stubbed at Phase 0 with a comment "Full implementation in Phase 3+."
It has not been implemented as of Phase 5 of the Latency Lab work. The lab was built to
be a testing tool for production behaviors — it cannot work with a stub prompt builder.

## What should be done

1. Implement `promptBuilder.ts` for real (replacing the stubs with the actual assembly logic
   that currently lives in `mentorHandler.ts`, `callA.ts`, and `labChatHandler.ts`).

2. Once implemented, refactor all three handlers to use `promptBuilder.ts` as the single
   source of prompt assembly truth.

3. At that point, remove the private builder functions from `labChatHandler.ts` and replace
   them with calls to `promptBuilder.ts`.

The divergence creates a risk: if the prompt format changes (new placeholders, new RAG
context structure, new scenario variables), `labChatHandler.ts` must be updated separately.
This reduces confidence that the lab accurately tests production prompt behavior.

## Estimated effort

2–4 hours: implement `promptBuilder.ts`, refactor the three handlers, update tests.

## Context

Affects: `packages/functions/src/prompts/promptBuilder.ts`,
`packages/functions/src/mentor/mentorHandler.ts`,
`packages/functions/src/coach/callA.ts`,
`packages/functions/src/lab/labChatHandler.ts`.

Also related: Gemini safety settings (`HARM_CATEGORY_DANGEROUS_CONTENT: BLOCK_ONLY_HIGH`)
are applied in `labChatHandler.ts` but NOT in `mentorHandler.ts` or `callA.ts`. This means
the lab may behave differently from production when responses touch crisis content.
That gap should be fixed in the production handlers as part of the promptBuilder refactor.
