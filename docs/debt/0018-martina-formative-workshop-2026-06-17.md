---
id: "0018"
title: "Formative workshop build (2026-06-17) — shortcuts and open items"
severity: medium
status: open
created: 2026-06-17
---

## Context

On 2026-06-17 the codebase was adapted for a live formative workshop with teachers.
Five stages of changes were made in rapid succession. This document records the shortcuts
taken and the open items they created.

## Changes made (Stages 1–5 + hotfixes)

### Stage 1 — Anonymous access (`/martina` route)
- `signInAnonymously` added to `auth.ts`.
- New page `MartinaDemo.tsx`: silent anon sign-in → direct navigation to Martina session.
- No user document is created for anonymous users. If anonymous users ever need a user
  doc (e.g., for role checks), the flow will break silently.
- **Open:** anonymous users cannot access the post-session report if the Firestore rule
  for `sessions/{id}` requires `userId` match and the session was created under an anon
  uid that has since been recycled.

### Stage 2 — Warm Martina persona
- `maxOutputTokens` for Call A: 120 → 320.
- Prompt language/style section rewritten for 2-5 sentences minimum, no monosyllabic wall.
- Seed script updated: `communicationStyle`, `emotionalBaseline`, `characterInstructions`,
  `welcomeMessage`.
- **Open:** `docs/prompts/coach_conversational_v1.md` is now out of sync with
  `content.ts` (the authoritative source). The markdown file is documentation only but
  will mislead future editors. Update it to match.

### Stage 3 — Matrix calibration
- Initial values: `apertura 4→5`, `confianzaEnLaAyuda 3→4`.
- `intensidadEmocional` floor: 5 → 2.
- `MATRIX_EVALUATOR_ADDENDUM` rewritten: generous rewards, max +1 punishment per turn,
  spatial penalty disabled, `RESET_ZERO` replaced with soft -2.
- **Open:** the new addendum was not clinically validated with Fundación Summer.
  The previous addendum (in git history at `98fd699`) is the last clinically-reviewed
  version. Run a delta review with the methodological team before production.

### Stage 4 — Bar UI feedback
- `changedVar: string | null` → `changedVars: Set<MatrixVarKey>` so all variables that
  change in a turn pulse simultaneously.
- Directional color flash: emerald (good direction) / rose (bad direction) during pulse.
- **Open:** the `.js` mirror files in `packages/web/src/` (legacy compiled artefacts)
  were NOT updated for `EmotionalMatrix.tsx` or `CoachSession.tsx`. Vite ignores them,
  but they will mislead anyone reading the `src/` directory.

### Stage 5 hotfixes (post-smoke-test)
- `coachTurn` timeout: 60s → 180s; memory: 256MiB → 512MiB.
- Call B `maxOutputTokens`: 2048 → 4096 (JSON was truncating with 8 tags + addendum).
- "Ir al informe" button moved from chat input area to aside panel below matrix bars;
  visible immediately but disabled (gray) for the first 5 minutes, then enabled (teal).
- Call B changed to fire-and-forget (see debt 0017).

## What was NOT done

- The Scenario 03 (Martina) seed was run against `summer-chatbot-dev` but NOT against
  production. Production Firestore still has the old persona.
- The Anonymous provider was enabled manually in Firebase Console — not scripted or
  documented in infrastructure-as-code.
- No tests were added or updated for any of the above changes.
- The `docs/prompts/` markdown files were not synced with `content.ts`.
