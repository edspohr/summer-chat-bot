// Formative feedback report schema. See docs/prompts/coach_feedback_v1.md.
//
// Design constraints (Fase 4, revised 2026-09-21):
//   - Tono formativo, NO evaluativo. Sin puntajes, sin aprobado/reprobado.
//   - Escrito en la voz del Mentor de Summer ChatBot ("noté que...",
//     "te sugiero..."), tuteo, cálido, breve. Nada de elogios vacíos: cada
//     reconocimiento apunta a una cita.
//   - Cada momento es un "acierto" (lo que funcionó y por qué) o una
//     "oportunidad" (dónde una jugada distinta puede aterrizar mejor,
//     con consejo + frase de ejemplo). Los aciertos NO llevan alternativa
//     — proponerla arriba de un logro lo diluye.
//   - Balance: aciertos ≥ oportunidades, máx 2 oportunidades, primer
//     momento siempre acierto (aunque sea pequeño). Enforced en el
//     superRefine de keyMoments.
//   - Los tips se anclan en los MUSTs de los tags del escenario (pasadas al
//     modelo). Si tocan recursos de ayuda oficial, usan solo *4141, Salud
//     Responde (600 360 7777 op.2), hablemosdetodo.injuv.gob.cl —
//     helpResources.ts.
//   - `nextChallenge`: un micro-desafío concreto y observable, se persiste
//     en la sesión y se muestra al inicio de la próxima como "Tu desafío
//     de hoy".
//   - `mentorQuestion`: primera persona del participante, prellenar el
//     chat del Mentor desde el botón "Hablar con el Mentor".
//   - Sesiones que pasaron por crisis y fueron retomadas: el turno que
//     disparó Layer 2/3 y el template de crisis se excluyen del material
//     enviado al modelo. Nunca citados.
//   - Sesiones `crisis_interrupted` NO reciben informe formativo.
//   - Contenido pedagógico marcado TODO_CLINICAL_VALIDATION.
import { z } from "zod";

export const OasisPhaseKeySchema = z.enum([
  "OBSERVA",
  "ACOGE",
  "SILENCIO",
  "ILUMINA",
  "SOSTEN",
]);

// Base fields shared by both moment kinds. Verified independently: quote
// against trainee messages, martinaCue against assistant messages.
const MomentBaseSchema = z.object({
  quote: z.string().min(1).max(500),
  martinaCue: z.string().min(1).max(500).optional(),
  oasisPhase: OasisPhaseKeySchema.optional(),
  whatHappenedWithMartina: z.string().min(20).max(400),
});

/**
 * Acierto: something the trainee did that worked. Carries `whyItWorked`
 * (the OASIS principle behind, in plain language, 1-2 sentences). No
 * alternative — proposing "how it could have been better" on top of a
 * success dilutes the recognition.
 */
export const AciertoMomentSchema = MomentBaseSchema.extend({
  kind: z.literal("acierto"),
  whyItWorked: z.string().min(10).max(300),
});

/**
 * Oportunidad: a place where a different move might land better. Carries
 * a `tip` = { advice (with the WHY), examplePhrase (ready to say, short,
 * realistic for a teacher in a hallway, LATAM-Chile Spanish) }. UI labels
 * examplePhrase as "ejemplo sugerido" with a TODO_CLINICAL_VALIDATION note.
 */
export const OportunidadMomentSchema = MomentBaseSchema.extend({
  kind: z.literal("oportunidad"),
  tip: z.object({
    // Up to 500 chars: "es muy natural X, con Martina la puerta abre por Y"
    // + the closing bridge to a real student sometimes reaches ~2 sentences
    // even when the model tries to keep it in one.
    advice: z.string().min(20).max(500),
    examplePhrase: z.string().min(5).max(240),
  }),
});

export const FormativeReportMomentSchema = z.discriminatedUnion("kind", [
  AciertoMomentSchema,
  OportunidadMomentSchema,
]);

export const FormativeReportContentSchema = z.object({
  /**
   * Warm 2-3 sentence summary of the shape of the conversation. Written
   * in the Mentor's voice. Describes, does not evaluate. Can close with
   * a motivating note about practicing again.
   */
  synthesis: z.string().min(40).max(600),
  /**
   * 2 to 4 key moments. Balance rules:
   *   - First moment is ALWAYS an acierto (even if small — a chosen pause,
   *     a specific word).
   *   - At most 2 oportunidades per report.
   *   - Aciertos ≥ oportunidades.
   * `verifyMoment` drops moments whose `quote` cannot be verified against
   * the trainee transcript; if fewer than 2 survive, the generator falls
   * through to a single retry and then to `minimal`.
   */
  keyMoments: z
    .array(FormativeReportMomentSchema)
    .min(2)
    .max(4)
    .superRefine((arr, ctx) => {
      if (arr.length === 0) return;
      if (arr[0]?.kind !== "acierto") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "First moment must be an acierto",
          path: [0, "kind"],
        });
      }
      const oportunidades = arr.filter((m) => m.kind === "oportunidad").length;
      const aciertos = arr.filter((m) => m.kind === "acierto").length;
      if (oportunidades > 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At most 2 oportunidades per report",
        });
      }
      if (aciertos < oportunidades) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Aciertos must be >= oportunidades",
        });
      }
    }),
  /** One concrete thing the trainee did that is worth keeping. */
  strengthToKeep: z.string().min(20).max(400),
  /**
   * ONE concrete focus for the next attempt. Coherent with nextChallenge
   * and with any tips — a single focus, not three topics.
   */
  focusForNextAttempt: z.string().min(20).max(400),
  /**
   * Exactly 2 open-ended self-reflection prompts, phrased to invite thought,
   * not justification. The trainee's answer is stored in
   * `sessions/{id}.reflexionAprendiz` after being run through Layer 3.
   */
  reflectionPrompts: z.array(z.string().min(10).max(240)).length(2),
  /**
   * A micro-challenge for the next practice: one concrete, observable move
   * the trainee can try. Derived from focusForNextAttempt. Persisted to
   * the session (`sessions/{id}.nextChallenge`) so the next visit shows
   * "Tu desafío de hoy" on the pre-session screen.
   */
  nextChallenge: z.string().min(20).max(300),
  /**
   * A question the participant might ask the Mentor about their focus,
   * written in the FIRST PERSON as if they were about to type it. The
   * UI's "Hablar con el Mentor" button prefills the Mentor chat with
   * this text.
   */
  mentorQuestion: z.string().min(10).max(240),
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
export type AciertoMoment = z.infer<typeof AciertoMomentSchema>;
export type OportunidadMoment = z.infer<typeof OportunidadMomentSchema>;
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
