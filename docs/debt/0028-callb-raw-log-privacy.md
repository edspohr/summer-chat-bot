---
id: 0028
title: `callB.ts` logs up to 500 chars of raw JSON on parse failure — may include trainee content
severity: medium
status: open
---

## What is broken

`packages/functions/src/coach/callB.ts` currently emits:

```
[COACH B] JSON parse failed — turn skipped. raw=<first 500 chars>...
```

when `JSON.parse(extractJsonObject(rawJson))` throws. The evaluator prompt
includes `[TRAINEE_TURN]` and 5 turns of `[CONVERSATION_HISTORY]`. When the
model's JSON output includes any of that text (paraphrased in
`justification`, cited in `observed_behaviors`, or leaked verbatim under a
malformed key), the first 500 characters land in Cloud Logging.

That is a leak of trainee content — and, in the worst case, of a
personal disclosure — into a plain-text log the platform does not gate
by role.

## Why medium (not high)

- The path only fires on a JSON parse failure. After debt-0017 (tolerant
  parsing landed 2026-09-21), those failures are already rare and getting
  rarer as flash-lite stabilises.
- Cloud Logging retention on `summer-chatbot-dev` is 30 days by default;
  the exposure window is bounded.
- The read surface is small (only project owners have Logs viewer).

Still: the eventual admin dashboard or a widened role could expose it.

## What should be done (Fase 5 or later, NOT in Fase 4)

1. Redact `raw` before logging. Concrete options:
   a. Log `rawLen` and `first 60 chars`, `last 60 chars`. Same signal for
      "is this truncated or malformed?" without the middle.
   b. Log only a fingerprint (SHA-256 of `raw`) and a small structural
      probe (first `}` position, count of `evaluated_tags` occurrences).
2. Apply the same redaction to `callBParse.ts::formatCallBSummary` if it
   ever grows to include raw content (today it only logs counts).
3. Same rule should be applied to the Fase 4 formative-report generator's
   own parse-failure path — it will have the identical failure mode.

## Related

- debt-0017 — tolerant parsing (fixed the frequency of the failure, not
  the log content).
- Fase 4 report generator — the log privacy rule "never write transcript,
  quotes or report content to Cloud Logging" is enforced there; this
  debt is the pre-existing spot where the rule is broken.

## Discovered

2026-09-21 during Fase 4 planning review (adjustment #10 from the
formative-sprint checklist).
