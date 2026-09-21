// Formative feedback report schema. See docs/prompts/coach_feedback_v1.md.
//
// Non-negotiable design constraints (from Fase 4 brief, 2026-09-21):
//   - Tono formativo, no evaluativo. Sin puntajes ni aprobado/reprobado.
//   - Sin diagnóstico del participante.
//   - Enfocado en el rol docente.
//   - Cada `quote` es un substring literal de un mensaje del participante
//     (verificado por reportGenerator antes de aceptar el momento).
//   - `suggestedAlternative` = contenido pedagógico. TODO_CLINICAL_VALIDATION.
//     Anclado en las MUSTs de los tags del escenario (pasadas al modelo).
//   - Sesiones que pasaron por crisis y fueron retomadas: el turno que
//     disparó Layer 2/3 y el template de crisis se excluyen del material
//     enviado al modelo. Nunca citados.
//   - Sesiones `crisis_interrupted` NO reciben informe formativo.
import { z } from "zod";

export const OasisPhaseKeySchema = z.enum([
  "OBSERVA",
  "ACOGE",
  "SILENCIO",
  "ILUMINA",
  "SOSTEN",
]);

export const FormativeReportMomentSchema = z.object({
  /**
   * Literal substring of a trainee message. Verified verbatim (after unicode
   * normalization + whitespace + case + smart-quote folding) by
   * reportGenerator; moments whose quote does not match are dropped.
   */
  quote: z.string().min(1).max(500),
  /**
   * Optional literal substring of a Martina message the trainee was
   * responding to (or that they let pass). Verified the same way against
   * assistant messages. If the cue does not verify, ONLY this field is
   * dropped — the moment survives.
   */
  martinaCue: z.string().min(1).max(500).optional(),
  /**
   * OASIS phase this moment maps to. Optional — some moments are cross-phase
   * (e.g. "presence" that doesn't fit one bucket).
   */
  oasisPhase: OasisPhaseKeySchema.optional(),
  /**
   * Human-language description of what happened after this intervention.
   * Matrix deltas are described in ordinary words ("Martina se abrió un
   * poco más"), never as numbers.
   */
  whatHappenedWithMartina: z.string().min(20).max(400),
  /**
   * Pedagogical example of an alternative response. Optional. When present,
   * it MUST be anchored in one of the tag definitions passed to the model.
   * The UI labels this "ejemplo sugerido" and carries a
   * TODO_CLINICAL_VALIDATION note. Kept short so the trainee can adapt it.
   */
  suggestedAlternative: z.string().max(500).optional(),
});

export const FormativeReportContentSchema = z.object({
  /**
   * Warm 2-3 sentence summary of the shape of the conversation. Describes,
   * does not evaluate. No "bueno" / "mal" / scores / percentages.
   */
  synthesis: z.string().min(40).max(600),
  /**
   * 2 to 4 key moments. The generator asks the model for these and then
   * drops any moment whose `quote` cannot be verified against the
   * transcript; if fewer than 2 survive, the report falls through to a
   * single retry and then to `minimal`.
   */
  keyMoments: z.array(FormativeReportMomentSchema).min(2).max(4),
  /** One concrete thing the trainee did that is worth keeping. */
  strengthToKeep: z.string().min(20).max(400),
  /** One concrete thing to try differently next time. */
  focusForNextAttempt: z.string().min(20).max(400),
  /**
   * Exactly 2 open-ended self-reflection prompts, phrased to invite thought,
   * not justification. The trainee's answer is stored in
   * `sessions/{id}.reflexionAprendiz` after being run through Layer 3.
   */
  reflectionPrompts: z.array(z.string().min(10).max(240)).length(2),
});

export const FormativeReportStatusSchema = z.enum([
  "generating",
  "ready",
  "failed",
  "minimal",
]);

/**
 * Reason for a status other than "ready". Preserved so the UI can render
 * the right minimal template without guessing.
 */
export const FormativeReportSkipReasonSchema = z.enum([
  "too_short",              // fewer than 3 trainee turns
  "crisis_interrupted",     // session never resumed after crisis
  "generation_failed",      // model call/parse/verification failed after retry
  "moments_unverifiable",   // <2 moments survived quote verification after retry
]);

export const FormativeReportSchema = z.object({
  status: FormativeReportStatusSchema,
  promptVersion: z.string(),
  /** ISO-8601 UTC. When `status === "generating"`, the moment the generation started. */
  generatedAtIso: z.string(),
  /** Model id used (e.g. "gemini-2.5-flash"). Absent for `minimal`/`failed`. */
  modelUsed: z.string().optional(),
  /** Present iff status === "ready". */
  content: FormativeReportContentSchema.optional(),
  /** Set when status is not "ready". Drives the UI's minimal template. */
  skipReason: FormativeReportSkipReasonSchema.optional(),
  /**
   * Free-form diagnostic string appended when the report is "failed" —
   * error message, retry count, etc. Not shown to the trainee.
   */
  failureDetail: z.string().max(500).optional(),
  /**
   * When true, the report was generated on a session that was resumed after
   * a safety event (crisis_interrupted → resumeAfterCrisis → active). The
   * turn that triggered the safety layer and the crisis template were
   * excluded from the prompt context. Recorded so an auditor can tell
   * "post-resume" reports apart at a glance.
   */
  wasResumedAfterCrisis: z.boolean().default(false),
});

export type OasisPhaseKey = z.infer<typeof OasisPhaseKeySchema>;
export type FormativeReportMoment = z.infer<typeof FormativeReportMomentSchema>;
export type FormativeReportContent = z.infer<typeof FormativeReportContentSchema>;
export type FormativeReportStatus = z.infer<typeof FormativeReportStatusSchema>;
export type FormativeReportSkipReason = z.infer<typeof FormativeReportSkipReasonSchema>;
export type FormativeReport = z.infer<typeof FormativeReportSchema>;

// ─── Reflexión del aprendiz (P4 safety-gated field on the session doc) ──

export const REFLECTION_MAX_CHARS = 2000 as const;

export const ReflectionSafetyMatchSchema = z.object({
  layer: z.literal("L3"),
  templateShown: z.enum(["REAL_DISTRESS", "FRAME_BREAK"]),
  patternMatched: z.string(),
  triggeredAtIso: z.string(),
});

export const ReflectionSchema = z.object({
  text: z.string().max(REFLECTION_MAX_CHARS),
  submittedAtIso: z.string(),
  /**
   * When the reflection matched a Layer 3 regex, its normal storage flow
   * halts: the text is still saved, but this field carries the safety
   * signal so the UI can render the crisis template instead of "guardado".
   * L2 is not run on reflections — they are always short, single-shot, and
   * the trainee is not in a roleplay anymore.
   */
  safetyMatch: ReflectionSafetyMatchSchema.nullable(),
});
export type Reflection = z.infer<typeof ReflectionSchema>;
export type ReflectionSafetyMatch = z.infer<typeof ReflectionSafetyMatchSchema>;
