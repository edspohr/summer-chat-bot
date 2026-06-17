---
id: 0011
title: Scenario 02 (Matías) has no definition document or Firestore seed data
severity: medium
status: open
---

## What was done

`LabScenarioSchema` includes `"matias"` as a valid scenario value, and the UI shows
"Matías (Escenario 02)" as a selectable scenario for `coach_raw` mode.

However:
- `docs/02_escenario_matias.md` does not exist.
- There is no Firestore seed data for a scenario with slug `"matias"`.
- `coach_context` mode for Matías returns an explicit Spanish error message and does
  not call Gemini (this is intentional, documented behavior).
- `coach_raw` mode for Matías works at the function level (no scenario data needed),
  but the character prompt contains no Matías-specific content — it's a generic
  coach prompt.

## Why

Scenario 02 was in scope for the architecture but was not designed or seeded as of
the Latency Lab sprint. Only Scenario 01 (Camila) has a full specification.
The architecture doc (03_arquitectura_tecnica.md) notes "Only the schema exists" for
Scenario 02+ as a known MVP gap.

## What should be done

1. Design `docs/02_escenario_matias.md` in collaboration with Fundación Summer's
   clinical team — similar structure to `docs/01_escenario_camila.md`.

2. Create a Firestore seed entry for `scenarios/matias` in the seed scripts.

3. Update `coach_context` mode in `labChatHandler.ts` to remove the "unavailable"
   guard once the scenario doc is available.

4. Update the UI in `LabChat.tsx` to remove the `disabled={matiasDisabled}` flag
   on the Matías option in `coach_context` mode.

## Estimated effort

2–3 days for clinical scenario design (Fundación Summer collaboration).
2–4 hours for technical implementation once the design is approved.

## Context

The Matías scenario was explicitly deferred from the MVP. Its eventual profile
should cover a different demographic from Camila to broaden training coverage
(e.g., adult male, different risk profile). See architecture doc section 8 for
the list of open clinical questions.
