// Vertex call for coach_feedback_v1. Kept in its own module so scripts that
// want to exercise the model without booting Firestore (fixtures runner,
// debugging) can import this and skip reportGenerator.ts.
//
// Log privacy: this module never logs prompt, raw response, or extracted
// quotes. Only structural metadata (finishReason, sizes, tokens).

import { VertexAI, type GenerationConfig } from "@google-cloud/vertexai";
import { VERTEX_PROJECT, VERTEX_REGION } from "../config/vertex.js";
import { retryOnQuota } from "../coach/vertexRetry.js";

export interface FeedbackModelInput {
  prompt: string;
  model: string;
  maxOutputTokens: number;
  thinkingBudget: number;
  timeoutMs: number;
  /** Feedback is a JSON emitter — default 0.5 gives some room for warmth. */
  temperature?: number;
}

export interface FeedbackModelResult {
  rawJson: string;
  finishReason: string | null;
  latencyMs: number;
  candidateTokens: number | null;
  thoughtsTokens: number | null;
  modelUsed: string;
}

export async function callFeedbackModel(input: FeedbackModelInput): Promise<FeedbackModelResult> {
  const vertexAI = new VertexAI({ project: VERTEX_PROJECT, location: VERTEX_REGION });
  const generationConfig: GenerationConfig = {
    temperature: input.temperature ?? 0.5,
    maxOutputTokens: input.maxOutputTokens,
    responseMimeType: "application/json",
  };
  // thinkingConfig is not in the SDK type surface yet but the API accepts it.
  // Same pattern as callA.ts and scripts/eval/run.ts::makeLiveDeps.
  const modelClient = vertexAI.getGenerativeModel({
    model: input.model,
    generationConfig: {
      ...generationConfig,
      // @ts-expect-error — thinkingConfig accepted by API, not yet typed.
      thinkingConfig: { thinkingBudget: input.thinkingBudget },
    },
  });

  const started = Date.now();
  const result = await retryOnQuota(() => modelClient.generateContent(input.prompt), {
    label: "feedback",
    timeoutMs: input.timeoutMs,
  });
  const latencyMs = Date.now() - started;

  const candidate = result.response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  let rawJson = "";
  for (const p of parts) if (typeof p.text === "string") rawJson += p.text;

  const usage = result.response.usageMetadata as
    | { candidatesTokenCount?: number; thoughtsTokenCount?: number }
    | undefined;
  return {
    rawJson,
    finishReason: candidate?.finishReason ?? null,
    latencyMs,
    candidateTokens: usage?.candidatesTokenCount ?? null,
    thoughtsTokens: usage?.thoughtsTokenCount ?? null,
    modelUsed: input.model,
  };
}
