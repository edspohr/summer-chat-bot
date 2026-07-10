// Copy for the Phase 4 (A7) crisis branching UX. Rendered by the CrisisOverlay
// on the client. This is UI text, NOT a Gemini prompt.
//
// PLACEHOLDERS — pending clinical validation with Camila (content owner).
// The client only sees these when config/runtime.crisisBranchingEnabled === true.
// While the flag is false, the legacy CrisisOverlay path (single "Estoy listo/a"
// button + resources template) is used unchanged.
//
// Frozen safety pipeline (packages/functions/src/safety/) is NEVER modified.
// This module only shapes what the trainee sees AFTER detection has already run.

import type { CrisisMeta } from "@salvador/shared";

// ── Opening pedagogical prompt (Camila TODO_CLINICAL_VALIDATION) ────────────
export const CRISIS_BRANCH_PROMPT_ID = "why_did_you_articulate_v0_placeholder";

export const CRISIS_BRANCH_PROMPT_TEXT =
  "Antes de continuar, quiero entender: ¿qué querías explorar con esa frase?";

// ── Branch: user says "this was part of the exercise" ───────────────────────
// After confirmation, the session is closed as crisis_interrupted and the
// client navigates to /report — no auto-resume (respects the "crisis never
// auto-resumes" invariant in CLAUDE.md).
export const CRISIS_BRANCH_EXERCISE_LABEL = "Era parte del ejercicio";

export const CRISIS_BRANCH_EXERCISE_FEEDBACK =
  "Gracias por decirlo. Hay algo importante que quiero que te lleves de este " +
  "momento: incluso en un ejercicio, las palabras que usamos para hablar de la " +
  "muerte importan. En una conversación real con un/a estudiante, una frase así " +
  "activa protocolos de crisis reales — llamadas, derivaciones, familia. Usarla " +
  "como recurso retórico puede confundir al otro y desgastar tu propia capacidad " +
  "de respuesta. Para esta sesión vamos a cerrar acá y ver tu informe.";

// ── Branch: user says "this is really happening to me" ──────────────────────
// After confirmation, the existing REAL_DISTRESS resources template is shown.
// The session stays paused; no auto-resume.
export const CRISIS_BRANCH_FLAGGED_REAL_LABEL = "Es algo real que me está pasando";

export const CRISIS_META_v0: CrisisMeta = {
  triggered: true,
  promptId: CRISIS_BRANCH_PROMPT_ID,
  branches: ["crisis_exercise", "crisis_flagged_real"],
};
