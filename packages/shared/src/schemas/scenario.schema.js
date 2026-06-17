import { z } from "zod";
const TimestampSchema = z.unknown();
export const EmotionalStateVariableSchema = z.object({
    initial: z.number().min(1).max(10),
    min: z.number().min(1).max(10).optional(),
    admissionThreshold: z.number().min(1).max(10).optional(),
});
export const ScenarioPersonaSchema = z.object({
    name: z.string(),
    age: z.number().int().positive(),
    role: z.string(),
    traits: z.array(z.string()),
    communicationStyle: z.string(),
    emotionalBaseline: z.string(),
    avatarUrl: z.string().optional(),
});
export const ScenarioTagRefSchema = z.object({
    tagId: z.string(),
    attributionType: z.enum(["conjunction", "addition"]),
    confidenceThreshold: z.number().min(0).max(1),
});
export const ScenarioClosingMessagesSchema = z.object({
    completed: z.string(),
    abandoned: z.string(),
    crisisInterrupted: z.string(),
});
export const ScenarioSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    persona: ScenarioPersonaSchema,
    initialSituation: z.string(),
    characterInstructions: z.string(),
    seedMessage: z.string(),
    emotionalStateVariables: z.object({
        emotionalIntensity: EmotionalStateVariableSchema,
        openness: EmotionalStateVariableSchema,
        trustInHelp: EmotionalStateVariableSchema,
    }),
    requiredTags: z.array(ScenarioTagRefSchema),
    expectedOutcome: z.string(),
    welcomeMessage: z.string(),
    closingMessages: ScenarioClosingMessagesSchema,
    active: z.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});
