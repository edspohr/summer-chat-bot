---
id: "0003"
title: Layer 3 regex patterns pending clinical co-validation with Fundación Summer
severity: high
status: open
---

## What was done

Five initial regex patterns for Layer 3 (Regex Preempt) were implemented in Phase 1:

| Category | Signal |
|---|---|
| `SUICIDAL_IDEATION_ACTIVE` | "quiero matarme / suicidarme" (present-tense) |
| `SUICIDAL_RUMINATION_ACTIVE` | "estoy pensando en matarme" (present active) |
| `SELF_HARM_ACTIVE` | "me estoy haciendo daño" / "me estoy cortando las muñecas" |
| `MEANS_WITH_INTENT` | "tengo pastillas para matarme" (possession + intent) |
| `MEANS_USED_INGESTION` | "me tomé las pastillas para matarme" (ingestion + intent) |

Each pattern anchors on first-person, present or recent-past tense, never conditional or
hypothetical. Each has ≥5 `examplesMatched` and ≥5 `examplesNotMatched` with a module-load
self-test. Chilean informal slang is not yet covered — that requires clinical input.

## Why

The clinical team at Fundación Summer was not available for a co-design session before
Phase 0 scaffolding. The patterns are technically valid but have not been reviewed by
mental health professionals with expertise in Chilean adolescent crisis language.

## What should be done

Schedule a co-design session with Fundación Summer clinical team to:
1. Review each existing pattern for false positive/negative risk
2. Add patterns for Chilean adolescent informal crisis language not covered by current set
3. Validate the `examplesNotMatched` list — false negatives in Layer 3 are the highest risk
4. Decide on a quarterly review cadence for the pattern set

**Do not deploy to production until this session is completed.**

## Estimated effort

Half-day workshop + 1 day of follow-up pattern refinement

## Context

Layer 3 is the first line of defense — it runs synchronously before any LLM call.
False negatives here mean the system does not pause when a real person is in crisis.
Layer 2 (LLM classifier) is the backstop, but it only runs when `[FRAME_BREAK_SUSPECTED]`
is appended by Call A. If a user sends a direct crisis signal without going through Call A
(e.g., in Mentor mode), Layer 3 is the only synchronous gate.
