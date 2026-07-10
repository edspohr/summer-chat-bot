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

// Phase 4 (A7) — pedagogical branching UX layered ON TOP of the frozen safety
// pipeline. When the pipeline flags AND `crisisBranchingEnabled` is on in
// config/runtime, the coach response ships a `crisisMeta` alongside the legacy
// `reply` template so the client can render the branch prompt + buttons.
// Copy is placeholder pending clinical validation with Camila.
export const CrisisBranchIdSchema = z.enum(["crisis_exercise", "crisis_flagged_real"]);

export const CrisisMetaSchema = z.object({
  triggered: z.literal(true),
  // Identifies which pedagogical prompt the client should render. Keeps copy
  // out of the schema so it can move without touching the wire.
  promptId: z.string(),
  branches: z.array(CrisisBranchIdSchema),
});

export type SafetyLayer = z.infer<typeof SafetyLayerSchema>;
export type SafetyClassification = z.infer<typeof SafetyClassificationSchema>;
export type SafetyTemplate = z.infer<typeof SafetyTemplateSchema>;
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type SafetyCheckInput = z.infer<typeof SafetyCheckInputSchema>;
export type SafetyCheckResult = z.infer<typeof SafetyCheckResultSchema>;
export type CrisisBranchId = z.infer<typeof CrisisBranchIdSchema>;
export type CrisisMeta = z.infer<typeof CrisisMetaSchema>;
