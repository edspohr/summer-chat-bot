import { z } from "zod";
// The three testable modes
export const LabModeSchema = z.enum([
    "mentor", // Salvador (Mentor character) — RAG-grounded methodology answers
    "coach_raw", // Coach mode with system prompt only — no scenario context injected
    "coach_context", // Coach mode with full context: scenario + persona + emotional state + behavior rules
]);
export const LabScenarioSchema = z.enum(["camila", "matias"]);
export const LabSimulationModeSchema = z.enum(["escenario", "promptPuro"]);
export const LabRequestSchema = z.object({
    message: z.string().min(1).max(4000),
    mode: LabModeSchema,
    // Simulation sub-mode (only meaningful for coach_context)
    simulationMode: LabSimulationModeSchema.default("escenario"),
    scenario: LabScenarioSchema.optional(),
    conversationHistory: z
        .array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
    }))
        .max(20)
        .default([]),
    promptVersion: z.string().default("coach_conversational_v1"),
    sessionLabel: z.string().max(100).optional(),
});
export const LabMetricsSchema = z.object({
    totalLatencyMs: z.number(),
    firstTokenLatencyMs: z.number().optional(),
    // Per-call latency breakdown (present when both character and evaluator fired)
    characterLatencyMs: z.number().optional(),
    evaluatorLatencyMs: z.number().optional(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    estimatedCostUsd: z.number(),
    safetyLayerTriggered: z.string().nullable(),
    geminiModel: z.string(),
    promptVersion: z.string(),
    region: z.literal("us-central1"),
    mode: LabModeSchema,
    simulationMode: LabSimulationModeSchema.optional(),
});
export const LabPromptSnapshotSchema = z.object({
    systemPromptLength: z.number(),
    contextInjected: z.boolean(),
    ragChunksUsed: z.number(),
    totalPromptTokensEstimated: z.number(),
});
import { EstadoMatrizSchema } from "./session.schema.js";
export const LabResponseSchema = z.object({
    content: z.string(),
    metrics: LabMetricsSchema,
    promptSnapshot: LabPromptSnapshotSchema,
    sessionId: z.string(),
    messageId: z.string(),
    timestamp: z.string(),
    // Present in coach_context + escenario mode
    estadoMatriz: EstadoMatrizSchema.nullable().optional(),
});
