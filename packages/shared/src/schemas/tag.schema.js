import { z } from "zod";
export const OasisPhaseSchema = z.enum([
    "OBSERVA",
    "ACOGE",
    "SILENCIO",
    "ILUMINA",
    "SOSTEN",
]);
export const AttributionTypeSchema = z.enum(["conjunction", "addition"]);
const TimestampSchema = z.unknown();
export const TagDefinitionSchema = z.object({
    tagId: z.string(),
    phase: OasisPhaseSchema,
    definition: z.string(),
    attributionType: AttributionTypeSchema,
    confidenceThreshold: z.number().min(0).max(1),
    musts: z.array(z.string()),
    outstanding: z.array(z.string()),
    positiveExamples: z.array(z.string()),
    negativeExamples: z.array(z.string()),
});
export const TagProgressSchema = z.object({
    sessionId: z.string(),
    tagId: z.string(),
    cumulativeScore: z.number().min(0),
    completed: z.boolean(),
    confidenceFinal: z.number().min(0).max(1).optional(),
    turnDetected: z.number().int().nonnegative().optional(),
    observedBehaviors: z.array(z.string()),
    justification: z.string().optional(),
    // One entry per turn that contributed evidence
    evidenceTurns: z.array(z.unknown()),
    updatedAt: TimestampSchema,
});
