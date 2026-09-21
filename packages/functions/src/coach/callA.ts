import { VertexAI, type GenerationConfig } from "@google-cloud/vertexai";
import type { CoachCallAInput } from "@salvador/shared";
import { VERTEX_PROJECT, VERTEX_REGION, GEMINI_MODEL } from "../config/vertex.js";
import { loadPrompt } from "../prompts/loader.js";
import { stripFrameBreakTag } from "./streamHandler.js";
import { retryOnQuota } from "./vertexRetry.js";

export interface CallAResult {
  content: string;
  frameBreakSuspected: boolean;
  latencyMs: number;
}

function buildSystemInstruction(input: CoachCallAInput, template: string): string {
  const { scenario, emotionalState, conversationHistory, traineeMessage } = input;

  const personaBlock = [
    `Nombre: ${scenario.persona.name}, ${scenario.persona.age} años`,
    `Rol respecto al aprendiz: ${scenario.persona.role}`,
    `Rasgos de personalidad: ${scenario.persona.traits.join(", ")}`,
    `Estilo comunicacional: ${scenario.persona.communicationStyle}`,
    `Estado emocional base: ${scenario.persona.emotionalBaseline}`,
  ].join("\n");

  const emotionalStateBlock = [
    `emotional_intensity: ${emotionalState.emotionalIntensity} / 10`,
    `openness: ${emotionalState.openness} / 10`,
    `trust_in_help: ${emotionalState.trustInHelp} / 10`,
  ].join("\n");

  const historyText =
    conversationHistory.length === 0
      ? "(Inicio de la conversación — sin historial previo)"
      : conversationHistory
          .map((t) => `${t.role === "user" ? "Aprendiz" : scenario.persona.name}: ${t.content}`)
          .join("\n\n");

  return template
    .replaceAll("[CHARACTER_NAME]", scenario.persona.name)
    .replace("[TRAINEE_RELATIONSHIP]", scenario.persona.role)
    .replace("[CHARACTER_PERSONA]", personaBlock)
    .replace("[INITIAL_SITUATION]", scenario.initialSituation)
    .replace("[EMOTIONAL_STATE_VARIABLES]", emotionalStateBlock)
    .replace("[CHARACTER_BEHAVIOR_RULES]", scenario.characterInstructions)
    .replace("[SCENARIO_BLOCK]", scenario.description)
    .replace("[CONVERSATION_HISTORY]", historyText)
    .replace("[TRAINEE_MESSAGE]", traineeMessage);
}

function buildPurePromptInstruction(
  conversationHistory: CoachCallAInput["conversationHistory"],
  traineeMessage: string,
  template: string,
): string {
  const historyText =
    conversationHistory.length === 0
      ? "(Inicio de la conversación — sin historial previo)"
      : conversationHistory
          .map((t) => `${t.role === "user" ? "Aprendiz" : "Personaje"}: ${t.content}`)
          .join("\n\n");

  return template
    .replace("[CONVERSATION_HISTORY]", historyText)
    .replace("[TRAINEE_MESSAGE]", traineeMessage);
}

interface StreamChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

interface StreamUsage {
  candidatesTokenCount: number | undefined;
  totalTokenCount: number | undefined;
  thoughtsTokenCount: number | undefined;
}

interface StreamResult {
  text: string;
  finishReason: string | undefined;
  usage: StreamUsage;
}

// Collects all streaming chunks into a single string.
// Using streaming here preserves the future path to true SSE delivery.
// Also captures the terminal finishReason and usageMetadata so we can tell
// truncated (MAX_TOKENS) or aborted (undefined) streams apart from normal STOP.
async function collectStream(stream: AsyncGenerator<StreamChunk>): Promise<StreamResult> {
  let text = "";
  let finishReason: string | undefined;
  const usage: StreamUsage = {
    candidatesTokenCount: undefined,
    totalTokenCount: undefined,
    thoughtsTokenCount: undefined,
  };
  for await (const chunk of stream) {
    const candidate = chunk.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (parts !== undefined) {
      for (const part of parts) {
        if (typeof part.text === "string") text += part.text;
      }
    }
    if (typeof candidate?.finishReason === "string") {
      finishReason = candidate.finishReason;
    }
    if (chunk.usageMetadata !== undefined) {
      if (typeof chunk.usageMetadata.candidatesTokenCount === "number") {
        usage.candidatesTokenCount = chunk.usageMetadata.candidatesTokenCount;
      }
      if (typeof chunk.usageMetadata.totalTokenCount === "number") {
        usage.totalTokenCount = chunk.usageMetadata.totalTokenCount;
      }
      if (typeof chunk.usageMetadata.thoughtsTokenCount === "number") {
        usage.thoughtsTokenCount = chunk.usageMetadata.thoughtsTokenCount;
      }
    }
  }
  return { text, finishReason, usage };
}

// thinkingConfig is not yet in @google-cloud/vertexai 1.12.0 types but is
// honored at runtime. Same pattern as safety/llmClassifier.ts. Disabling
// thinking here because the entire maxOutputTokens budget was being consumed
// by thoughts, truncating Martina's replies to 20–40 visible tokens (34%
// MAX_TOKENS rate observed in prod-dev over 24h before this fix).
type GenerationConfigWithThinking = GenerationConfig & {
  thinkingConfig: { thinkingBudget: number };
};

const CALL_A_GENERATION_CONFIG: GenerationConfigWithThinking = {
  temperature: 0.85,
  topP: 0.95,
  maxOutputTokens: 600,
  thinkingConfig: { thinkingBudget: 0 },
};

export async function runCallA(
  input: CoachCallAInput,
  modo: "escenario" | "promptPuro" = "escenario",
): Promise<CallAResult> {
  const callStart = Date.now();

  let systemInstruction: string;
  if (modo === "promptPuro") {
    const template = await loadPrompt("coach_pure_prompt_v1");
    systemInstruction = buildPurePromptInstruction(
      input.conversationHistory,
      input.traineeMessage,
      template,
    );
  } else {
    const template = await loadPrompt("coach_conversational_v1");
    systemInstruction = buildSystemInstruction(input, template);
  }

  const vertexAI = new VertexAI({ project: VERTEX_PROJECT, location: VERTEX_REGION });
  const model = vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
    generationConfig: CALL_A_GENERATION_CONFIG,
  });

  // 20s per-attempt deadline; two Vertex calls in Fase 2 baseline hung ~5min
  // before Node's headers timeout fired. Baseline p90 is ~1.8s, so 20s is a
  // comfortable ceiling that still catches wedged connections early.
  const streamed = await retryOnQuota(
    async () => {
      const streamResult = await model.generateContentStream(input.traineeMessage);
      return collectStream(streamResult.stream);
    },
    { label: "callA", timeoutMs: 20_000 },
  );

  const latencyMs = Date.now() - callStart;

  // Stream finish diagnostics — MAX_TOKENS means Martina was truncated;
  // undefined/absent finishReason means the stream died mid-flight (DSQ abort
  // is the current suspect). STOP is the only clean terminator.
  const finishReason = streamed.finishReason ?? "NONE";
  const candidatesTokens = streamed.usage.candidatesTokenCount ?? "unknown";
  const thoughtsTokens = streamed.usage.thoughtsTokenCount ?? 0;
  const line = `[CALLA] finishReason=${finishReason} candidatesTokens=${candidatesTokens} thoughtsTokens=${thoughtsTokens} latencyMs=${latencyMs}`;
  if (streamed.finishReason === "STOP") {
    console.log(line);
  } else {
    console.warn(line);
  }

  const stripped = stripFrameBreakTag(streamed.text);

  return { ...stripped, latencyMs };
}
