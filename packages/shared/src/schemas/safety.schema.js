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
