// Matrix evaluator prompt — editable by the methodological team without touching code.
// SEAM: this string is the only place that encodes matrix delta rules for Gemini.
// Changing variable definitions or anti-pattern thresholds only requires editing here.
// Referenced in callB.ts as MATRIX_EVALUATOR_ADDENDUM injected into the evaluator prompt.
export const MATRIX_EVALUATOR_ADDENDUM = `
# Emotional matrix evaluation (additional output required)

In addition to the tag evaluation above, you must also evaluate how the trainee's
most recent turn affects the character's three internal emotional variables.
This evaluation runs in the same call and uses the same conversation context.

Calibration principle: this is a FORMATIVE demo for novice teachers. Reward any genuine
warm effort generously. Punishments are gentle and never stack within a single turn.
Bias toward small positive movement — the gamification must feel gratifying, not punitive.

## The three variables and their rules

### intensidadEmocional (current value in EMOTIONAL_STATE_VARIABLES above)
Range 1..10. Goal: bring it DOWN to 1.
  INCREASES (at most +1 per turn, never stack multiple causes):
    - +1: trainee minimizes pain, uses toxic positivity, fires a cascade of questions,
      or asserts rigid school authority
  DECREASES:
    - -1: trainee delivers any warm, non-judgmental response (listening, presence, kindness)
    - -2: trainee delivers precise emotional validation (names the specific emotion observed)
  FLOOR RULE: cannot drop below 2 while the floor is active (see engine). Floor lifts when
    confianzaEnLaAyuda >= 7 AND derivacionAcordada is true.

### apertura (current value in EMOTIONAL_STATE_VARIABLES above)
Range 1..10. Goal: bring it UP to 10.
  NOTE: do NOT apply any spatial penalty for remaining in a public space. Martina is at
  school; the context is a hallway conversation. Ignore any prior spatial-modifier rule.
  INCREASES:
    - +1: trainee demonstrates any warm, attentive, or patient behaviour (paraphrase,
      reflection, brief acknowledgment, gentle presence, not interrupting)
    - +2: trainee asks a well-formed direct question about ideation, explicitly named
      (only valid AFTER at least one prior validation turn)
    - +1: trainee explicitly proposes moving to a private space (bonus, not required)
  DECREASES (at most -1 per turn):
    - -1: trainee fires cascade questions without space, or appeals to teacher authority

### confianzaEnLaAyuda (current value in EMOTIONAL_STATE_VARIABLES above)
Range 0..10. Goal: bring it UP to 10.
  INCREASES:
    - +1: trainee maps any safe personal bond (grandfather, friend Vale, sister)
    - +1: trainee mentions or normalises the school counsellor / orientadora with warmth
    - +2: trainee co-constructs an accompanied bridge to the school counsellor
      (offers to go together, frames it as support not reporting)
  SOFT DROP (replaces all hard resets):
    - -2: trainee is explicitly dismissive/bureaucratic AND breaches confidentiality in
      the same turn ("habla con la psicóloga y ya" while also saying "voy a llamar a
      tu mamá"). Both conditions must be present simultaneously.
    - -1: trainee mentions referral in a cold/administrative way without accompaniment
      ("anda donde la orientadora")
  IMPORTANT: a single clumsy referral ("habla con la orientadora") is NOT a hard reset.
  Never output "RESET_ZERO". Use integer deltas only for this variable.

## Output format for matrix (add as sibling key to evaluated_tags)

"matrixDelta": {
  "deltaIntensidadEmocional": <integer in [-3, +3]>,
  "deltaApertura": <integer in [-3, +3]>,
  "deltaConfianzaEnLaAyuda": <integer in [-3, +3]>,
  "tagsObservados": ["tag IDs from evaluated_tags where evidence_detected=true"],
  "antiPatronesDetectados": ["anti-pattern IDs triggered this turn"],
  "razonamientoBreve": "<= 140 chars explaining main reason for delta>"
}

If the trainee turn has no clear effect on a variable, output 0 for that delta.
Never output "RESET_ZERO" — use -2 for the most severe negative event.
`;

// Initial matrix state for scenario "martina" — re-exported from
// @salvador/shared so web, functions, the seed and the export script all read
// the same numbers. Runtime source of truth: this constant. The scenario
// document's emotionalStateVariables field is decorative (see debt/0022).
import { MARTINA_INITIAL_MATRIX } from "@salvador/shared";
export const INITIAL_ESTADO_MATRIZ = MARTINA_INITIAL_MATRIX;

// SESSION_DURATION_SECONDS removed 2026-09-20: sessions no longer have a hard
// cutoff. The "session complete" threshold now lives in @salvador/shared as
// SESSION_COMPLETE_AT_SECONDS. Session closure is driven by the inactivity
// scheduler or an explicit end from the user.
