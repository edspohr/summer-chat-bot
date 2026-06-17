// Matrix evaluator prompt — editable by the methodological team without touching code.
// SEAM: this string is the only place that encodes matrix delta rules for Gemini.
// Changing variable definitions or anti-pattern thresholds only requires editing here.
// Referenced in callB.ts as MATRIX_EVALUATOR_ADDENDUM injected into the evaluator prompt.
export const MATRIX_EVALUATOR_ADDENDUM = `
# Emotional matrix evaluation (additional output required)

In addition to the tag evaluation above, you must also evaluate how the trainee's
most recent turn affects the character's three internal emotional variables.
This evaluation runs in the same call and uses the same conversation context.

## The three variables and their rules

### intensidadEmocional (current value in EMOTIONAL_STATE_VARIABLES above)
Range 1..10. Goal: bring it DOWN to 1.
  INCREASES (+1 or +2):
    - Trainee minimizes the character's pain ("no es para tanto", "otros están peor")
    - Trainee uses toxic positivity ("todo va a estar bien", "sé positiva/o")
    - Trainee fires multiple questions in a single turn without pause
    - Trainee asserts rigid pedagogical authority ("como profesor/a debo decirte…")
  DECREASES (-1):
    - Trainee delivers precise emotional validation (names the specific emotion observed)
  FLOOR RULE: cannot drop below 5 UNLESS both are true:
    (a) confianzaEnLaAyuda >= 7
    (b) derivacionAcordada is true (an accompanied referral was verbally agreed in-context)

### apertura (current value in EMOTIONAL_STATE_VARIABLES above)
Range 1..10. Goal: bring it UP to 10.
  SPATIAL MODIFIER (apply once only, first occurrence):
    - If conversation is still in a public space past turn 3 AND trainee has NOT proposed
      moving: delta -2
    - When trainee explicitly proposes moving to a private or safe space: delta +2
  INCREASES:
    - +1: trainee demonstrates active listening (paraphrase, reflection, brief acknowledgment)
    - +2: trainee asks a well-formed direct question about ideation, explicitly named
      (only valid AFTER at least one prior validation turn)
  DECREASES:
    - -1: trainee fires multiple questions without space ("¿y cuándo? ¿y por qué? ¿y desde cuándo?")
    - -1: trainee makes comparison to the character's father (in this scenario, a stressor)
    - -1: trainee appeals to teacher authority ("como tu profe te digo…")

### confianzaEnLaAyuda (current value in EMOTIONAL_STATE_VARIABLES above)
Range 1..10. Goal: bring it UP to 10.
  INCREASES:
    - +1: trainee maps a safe personal bond (grandfather, friend Vale, sister)
    - +2: trainee co-constructs an accompanied bridge to the school psychologist
  HARD RESET TO 0:
    - Dismissive/bureaucratic referral ("habla con la psicóloga y ya", "ese no es mi tema")
    - Premature breach of confidentiality ("voy a tener que llamar a tu apoderada altiro")

## Output format for matrix (add as sibling key to evaluated_tags)

"matrixDelta": {
  "deltaIntensidadEmocional": <integer in [-3, +3]>,
  "deltaApertura": <integer in [-3, +3]>,
  "deltaConfianzaEnLaAyuda": <integer in [-3, +3] OR the string "RESET_ZERO">,
  "tagsObservados": ["tag IDs from evaluated_tags where evidence_detected=true"],
  "antiPatronesDetectados": ["anti-pattern IDs triggered this turn"],
  "razonamientoBreve": "<= 140 chars explaining main reason for delta>"
}

If the trainee turn has no clear effect on a variable, output 0 for that delta.
Only output "RESET_ZERO" for deltaConfianzaEnLaAyuda if a hard-reset anti-pattern is present.
`;

// Initial matrix state for scenario "martina" (and any scenario that does not override it)
export const INITIAL_ESTADO_MATRIZ = {
  intensidadEmocional: 6,
  apertura: 4,
  confianzaEnLaAyuda: 3,
  pisoIntensidadActivo: true,
  derivacionAcordada: false,
} as const;

export const SESSION_DURATION_SECONDS = 600; // 10 minutes
