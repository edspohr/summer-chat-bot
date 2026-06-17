import { z } from "zod";

export const SafetyLayerSchema = z.enum(["L1", "L2", "L3"]);

export const SafetyClassificationSchema = z.enum(["S", "D", "N"]);

export const SafetyTemplateSchema = z.enum(["REAL_DISTRESS", "FRAME_BREAK"]);

export const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  turnNumber: z.number().int().nonnegative(),
});

export const SafetyCheckInputSchema = z.object({
  message: z.string(),
  lastTurns: z.array(ConversationTurnSchema),
  sessionId: z.string(),
  mode: z.enum(["mentor", "coach"]),
  frameBreakSuspected: z.boolean(),
});

export const SafetyCheckResultSchema = z.object({
  isSafe: z.boolean(),
  layer: SafetyLayerSchema.nullable(),
  classification: SafetyClassificationSchema,
  template: SafetyTemplateSchema.nullable(),
  patternMatched: z.string().nullable(),
});

export type SafetyLayer = z.infer<typeof SafetyLayerSchema>;
export type SafetyClassification = z.infer<typeof SafetyClassificationSchema>;
export type SafetyTemplate = z.infer<typeof SafetyTemplateSchema>;
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type SafetyCheckInput = z.infer<typeof SafetyCheckInputSchema>;
export type SafetyCheckResult = z.infer<typeof SafetyCheckResultSchema>;
