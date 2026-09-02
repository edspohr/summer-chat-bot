---
id: "0020"
title: "EST-01 · finishReason logged as plain text, no client fallback for truncated Martina"
severity: medium
status: open
created: 2026-09-02
---

## What was done and why

After the 2026-08-11 workshop incident, [`packages/functions/src/coach/callA.ts`](../../packages/functions/src/coach/callA.ts) L184–191
started emitting a diagnostic line per Call A response:

```
[CALLA] finishReason=<STOP|MAX_TOKENS|NONE|...> candidatesTokens=<n> thoughtsTokens=<n> latencyMs=<n>
```

The line is written with `console.log` when `finishReason === "STOP"` and
`console.warn` otherwise. It is **plain text**, not a structured Cloud Logging
field.

`thinkingBudget=0` on Call A largely eliminated the "thoughts eat the token
budget → 20–40 visible-token replies" bug that motivated the log line. What we
now want to know is whether any `MAX_TOKENS` or other non-`STOP` finish reason
still slips through post-optimisation.

## Diagnosis (measurement block · MED / EST-01)

- **Where to query today.**
  Cloud Logging on `summer-chatbot-dev`:

  ```
  resource.type="cloud_run_revision"
  resource.labels.service_name="coach"
  textPayload:"[CALLA] finishReason="
  ```

  Add `severity>=WARNING` or `textPayload:"MAX_TOKENS"` to isolate non-STOP
  events. Default log retention is 30 days, so historical answers beyond that
  window are lost.

- **Is there a Firestore field?**
  No. `finishReason` is not stamped on assistant messages or session docs.
  A dashboard indicator ("% de respuestas truncadas") would need one.

- **Client-side fallback?**
  None. [`packages/web/src/pages/CoachSession.tsx`](../../packages/web/src/pages/CoachSession.tsx) receives Call A's output
  from `streamHandler` unchanged (only the `[FRAME_BREAK_SUSPECTED]` tag is
  stripped, see [`packages/functions/src/coach/streamHandler.ts`](../../packages/functions/src/coach/streamHandler.ts)). A truncated Martina reply is delivered as-is; the UI cannot detect it or
  offer a retry.

## Consequences

- **Observability gap.** Rate of truncated replies is invisible outside Cloud
  Logging. The admin dashboard cannot show it.
- **UX gap.** When a truncation slips past, the trainee sees a Martina turn
  that ends mid-sentence with no explanation and no way to ask her to finish.
- **Debug gap.** Because `finishReason` is plain text, we can't join it to a
  session id to investigate a specific complaint.

## How to fix (proposed as a separate prompt)

1. Emit `finishReason` as a **structured** log field so we can filter by it
   without regex, e.g.:

   ```ts
   logger.warn(
     { finishReason, sessionId, turnCount, candidatesTokens, latencyMs },
     "callA_finish",
   );
   ```

2. Stamp `meta.finishReason` on the assistant message document written by
   `appendMessage`. This unlocks a dashboard indicator "sesiones con al menos
   una respuesta truncada" and per-session investigation.

3. Optional: auto-retry Call A once when `finishReason === "MAX_TOKENS"` with
   `maxOutputTokens` bumped (e.g. 600 → 900). Gate behind a runtime flag so we
   can compare rates before/after.

Owner: TBD. Depends on: nothing (all local to `callA.ts` + shared message
schema).
