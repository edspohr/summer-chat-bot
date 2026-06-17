import { VertexAI, type GenerationConfig } from "@google-cloud/vertexai";
import type { SafetyClassification, ConversationTurn } from "@salvador/shared";
import { VERTEX_REGION, VERTEX_PROJECT, GEMINI_MODEL } from "../config/vertex.js";

export interface ClassifierInput {
  message: string;
  lastTurns: ConversationTurn[];
  mode: "mentor" | "coach";
}

const SYSTEM_PROMPT = `You are a mental health safety classifier for a suicide prevention training chatbot called Salvador.

Users are trainees practicing first-aid skills in roleplay scenarios. They play the role of a HELPER responding to someone in crisis — they do NOT play the person in crisis.

Classify the CURRENT MESSAGE from the trainee. Output EXACTLY ONE character:

S — The trainee is expressing real suicidal ideation or imminent self-harm about themselves (not a roleplay character). Any reader would agree this is a real emergency.
D — The trainee appears to step outside the training frame and express real personal distress, but without imminent risk. Something feels off — the message is no longer about the practice scenario.
N — Normal training message: roleplay response, methodology question, practice feedback, or in-character dialogue.

Asymmetry rule: a false positive (pausing training) is acceptable. A false negative (missing a real crisis) is not. When uncertain between S/D and N, prefer S or D.

Output only the single character S, D, or N. Nothing else.`;

// thinkingConfig is not yet in @google-cloud/vertexai 1.12.0 types but is honored at runtime.
// The intersection type passes it through without type errors.
type GenerationConfigWithThinking = GenerationConfig & {
  thinkingConfig: { thinkingBudget: number };
};

const CLASSIFIER_GENERATION_CONFIG: GenerationConfigWithThinking = {
  temperature: 0.1,
  maxOutputTokens: 10,
  thinkingConfig: { thinkingBudget: 0 },
};

function extractText(response: Awaited<ReturnType<ReturnType<VertexAI["getGenerativeModel"]>["generateContent"]>>): string {
  const parts = response.response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (typeof part.text === "string" && part.text.length > 0) {
      return part.text.trim();
    }
  }
  return "";
}

function parseClassification(raw: string): SafetyClassification {
  const char = raw[0]?.toUpperCase();
  if (char === "S" || char === "D" || char === "N") return char;
  return "N";
}

export async function classifyMessage(
  input: ClassifierInput
): Promise<SafetyClassification> {
  const vertexAI = new VertexAI({
    project: VERTEX_PROJECT,
    location: VERTEX_REGION,
  });

  const model = vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: CLASSIFIER_GENERATION_CONFIG,
  });

  const contextLines = input.lastTurns
    .slice(-4)
    .map((t) => `${t.role === "user" ? "TRAINEE" : "COACH"}: ${t.content}`)
    .join("\n");

  const userMessage = contextLines.length > 0
    ? `Context (last turns):\n${contextLines}\n\nClassify this message from the trainee:\n${input.message}`
    : `Classify this message from the trainee:\n${input.message}`;

  const result = await model.generateContent(userMessage);
  const raw = extractText(result);
  return parseClassification(raw);
}
