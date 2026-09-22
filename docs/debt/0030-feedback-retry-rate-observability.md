# 0030 — Feedback `schema_invalid` retry rate not observable; evaluate `responseSchema` if >⅓

**Severity**: low
**Status**: open
**Registered**: 2026-09-21 (post-deploy log review, Sprint 1 close)

## Symptom

Golden path's first informe returned `schema_invalid` on attempt 1 and was
rescued by the temperature=0 retry. This is the intended fallback and the
final envelope was fine, but there is no counter today to know how often
it happens across live sessions.

## Fix — two parts

### Part 1 — instrument (Sprint 2)

Add a boolean/counter to the `[FEEDBACK] ready` log line indicating whether
the report needed a retry (and which class of retry — `schema_invalid`,
`moments_unverifiable`, `MAX_TOKENS`). No transcript, no content — same
privacy rules as the rest of the pipeline.

Location: `packages/functions/src/session/reportGenerator.ts`, the `ready`
branch's log statement.

### Part 2 — decide after one week of data

If **>⅓ of reports need retry**, don't accept it as normal. Options in
increasing invasiveness:

1. Tighten the prompt (add a "before returning, verify each field against
   the schema" step and one extra JSON example).
2. Switch from prompt-only JSON to Gemini `responseSchema` structured output.
   Trade-off: we lose some control over prose length caps that Zod enforces,
   but we get parse-guaranteed shape.

If **≤⅓**, do nothing beyond the instrumentation — the retry is doing its
job cheaply.

## Why low severity

The retry mechanism works and shields the user from schema failures. This
is a cost/reliability optimization, not a correctness gap. Priority is only
"is the retry becoming the primary path" — hence the one-week review gate.
