import { VertexAI } from "@google-cloud/vertexai";
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

// Collects all streaming chunks into a single string.
// Using streaming here preserves the future path to true SSE delivery.
async function collectStream(
  stream: AsyncGenerator<{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }>
): Promise<string> {
  let text = "";
  for await (const chunk of stream) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (parts === undefined) continue;
    for (const part of parts) {
      if (typeof part.text === "string") text += part.text;
    }
  }
  return text;
}

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
    generationConfig: { temperature: 0.85, topP: 0.95, maxOutputTokens: 600 },
  });

  const rawContent = await retryOnQuota(
    async () => {
      const streamResult = await model.generateContentStream(input.traineeMessage);
      return collectStream(streamResult.stream);
    },
    { label: "callA" },
  );

  const latencyMs = Date.now() - callStart;
  const stripped = stripFrameBreakTag(rawContent);

  return { ...stripped, latencyMs };
}
