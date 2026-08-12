import { VertexAI } from "@google-cloud/vertexai";
import type { CoachCallBInput, EvaluatorRawOutput } from "@salvador/shared";
import { EvaluatorRawOutputSchema } from "@salvador/shared";
import { VERTEX_PROJECT, VERTEX_REGION, CALLB_MODEL } from "../config/vertex.js";
import { loadPrompt } from "../prompts/loader.js";
import type { TagDefinition } from "@salvador/shared";
import { MATRIX_EVALUATOR_ADDENDUM } from "./matrixConstants.js";
import { retryOnQuota } from "./vertexRetry.js";

function formatPendingTags(tags: TagDefinition[]): string {
  if (tags.length === 0) return "(No hay tags pendientes en este turno)";
  return tags
    .map((t) =>
      [
        `tag_id: ${t.tagId}`,
        `phase: ${t.phase}`,
        `definition: ${t.definition}`,
        `attribution_type: ${t.attributionType}`,
        `confidence_threshold: ${t.confidenceThreshold}`,
        `musts:\n${t.musts.map((m) => `  - ${m}`).join("\n")}`,
        `outstanding:\n${t.outstanding.map((o) => `  - ${o}`).join("\n")}`,
        `positive_examples:\n${t.positiveExamples.map((e) => `  - ${e}`).join("\n")}`,
        `negative_examples:\n${t.negativeExamples.map((e) => `  - ${e}`).join("\n")}`,
      ].join("\n")
    )
    .join("\n\n---\n\n");
}

function buildPrompt(input: CoachCallBInput, template: string, includeMatrix: boolean): string {
  const historyText =
    input.conversationHistory.length === 0
      ? "(Sin historial previo)"
      : input.conversationHistory
          .map((m) => `${m.role === "user" ? "Aprendiz" : "Personaje"}: ${m.content}`)
          .join("\n\n");

  const base = template
    .replace("[PENDING_TAGS]", formatPendingTags(input.pendingTags))
    .replace("[SCENARIO_CONTEXT_SUMMARY]", input.scenarioContextSummary)
    .replace("[CONVERSATION_HISTORY]", historyText)
    .replace("[TRAINEE_TURN]", input.traineeTurn);

  return includeMatrix ? base + MATRIX_EVALUATOR_ADDENDUM : base;
}

const EMPTY_OUTPUT: EvaluatorRawOutput = { evaluated_tags: [] };

// flash-lite occasionally wraps JSON in ```json fences or emits prose before/after
// the object. Strip fences and slice to the outermost {...} before JSON.parse.
function extractJsonObject(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) {
    return s.slice(first, last + 1);
  }
  return s;
}

export async function runCallB(
  input: CoachCallBInput,
  includeMatrix = false,
): Promise<EvaluatorRawOutput> {
  if (input.pendingTags.length === 0 && !includeMatrix) return EMPTY_OUTPUT;

  const template = await loadPrompt("coach_evaluator_v1");
  const prompt = buildPrompt(input, template, includeMatrix);

  const vertexAI = new VertexAI({ project: VERTEX_PROJECT, location: VERTEX_REGION });
  // Call B: temperature 0.2; JSON structured output.
  // 4096 tokens when evaluating tags+matrix (8 tags * ~400 tokens each + matrix delta).
  // 256 tokens when matrix-only (no tags to evaluate).
  const model = vertexAI.getGenerativeModel({
    model: CALLB_MODEL,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: includeMatrix ? 4096 : 256,
      responseMimeType: "application/json",
    },
  });

  const result = await retryOnQuota(() => model.generateContent(prompt), { label: "callB" });
  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  let rawJson = "";
  for (const part of parts) {
    if (typeof part.text === "string") rawJson += part.text;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(rawJson));
  } catch {
    console.warn(
      `[CALLB] JSON parse failed, turn skipped — raw: ${rawJson.slice(0, 500)}`,
    );
    return EMPTY_OUTPUT;
  }

  const validated = EvaluatorRawOutputSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[CALL B] Schema validation failed:", validated.error.flatten());
    return EMPTY_OUTPUT;
  }

  return validated.data;
}
