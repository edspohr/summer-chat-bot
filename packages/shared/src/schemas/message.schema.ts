import { z } from "zod";

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);

const TimestampSchema = z.unknown();

// Matrix delta emitted per evaluator turn.
// confianzaEnLaAyuda can be RESET_ZERO (hard reset per spec) or an integer in [-3,+3].
export const MatrixDeltaSchema = z.object({
  deltaIntensidadEmocional: z.number().int().min(-3).max(3),
  deltaApertura: z.number().int().min(-3).max(3),
  deltaConfianzaEnLaAyuda: z.union([z.number().int().min(-3).max(3), z.literal("RESET_ZERO")]),
  tagsObservados: z.array(z.string()),
  antiPatronesDetectados: z.array(z.string()),
  razonamientoBreve: z.string().max(140),
});

// `musts_met` is intentionally lenient: baseline v1 (2026-09-21) showed
// flash-lite omits this field on 81/87 payloads, always for tags with
// `evidence_detected=false`. Defaulting to `[]` preserves the strict path
// (`callBParse.ts::parseTolerantEvaluatorOutput.strictOk === true`) and
// does NOT change the scoring for detected tags: `tagAccumulator.ts` uses
// `musts_met.length > 0` for full-credit weight, so an omitted-then-defaulted
// value gives the same weight (0.5 via evidence_detected) as before the fix.
export const EvaluatorRawOutputSchema = z.object({
  evaluated_tags: z.array(
    z.object({
      tag_id: z.string(),
      evidence_detected: z.boolean(),
      confidence: z.number().min(0).max(1),
      musts_met: z.array(z.string()).default([]),
      musts_missing: z.array(z.string()),
      outstanding_observed: z.boolean(),
      anti_patterns_observed: z.array(z.string()),
      observed_behaviors: z.array(z.string()),
      justification: z.string(),
    })
  ),
  // Matrix deltas — present on every non-safety turn in coach/escenario mode
  matrixDelta: MatrixDeltaSchema.optional(),
});

export const MessageSchema = z.object({
  sessionId: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  turnNumber: z.number().int().nonnegative(),
  // Audit only — never sent to the client
  evaluatorOutput: EvaluatorRawOutputSchema.optional(),
  safetyLayerTriggered: z.enum(["L1", "L2", "L3"]).optional(),
  promptVersion: z.string(),
  createdAt: TimestampSchema,
});

export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type MatrixDelta = z.infer<typeof MatrixDeltaSchema>;
export type EvaluatorRawOutput = z.infer<typeof EvaluatorRawOutputSchema>;
export type Message = z.infer<typeof MessageSchema>;
