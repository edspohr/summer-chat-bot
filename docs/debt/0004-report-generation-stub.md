---
id: "0004"
title: reportGenerator.ts is a stub — real logic depends on pending clinical decisions
severity: medium
status: open
---

## What was done

`packages/functions/src/session/reportGenerator.ts` is implemented as a stub that returns
a placeholder object. No actual report generation logic is implemented.

## Why

The closing report format (structure, content, tone, what to show vs. hide) requires
clinical decisions from Fundación Summer that are still open as of Phase 0:
- Report by OASIS phase (5 sections) or by achievement level (strengths / growth areas)?
- Which evaluator justifications to surface to the trainee vs. keep internal?
- How to present anti-patterns without being discouraging?
- Minimum threshold to mark a tag as "demonstrated" in the report?

## What should be done

After clinical review session (see debt 0003), implement `reportGenerator.ts` with:
1. Aggregate all `tag_progress` documents for the session
2. Group by OASIS phase
3. Generate per-tag summary (demonstrated / partial / not observed) using stored
   `observedBehaviors` and `justification` fields — never exposing raw `evaluatorOutput`
4. Flag anti-pattern cascade if 4+ consecutive severe anti-patterns were logged
5. Return structured `SessionReport` object that `SessionReport.tsx` renders

## Estimated effort

3–5 days (after clinical format decisions are made)

## Context

The `evaluatorOutput` field in Firestore messages is for audit only — it is never sent
to the client. The report is a curated view derived from `tag_progress` documents.
The `SessionReport.tsx` component is also a stub waiting on this implementation.
