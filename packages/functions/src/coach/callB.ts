import { VertexAI } from "@google-cloud/vertexai";
import type { CoachCallBInput, EvaluatorRawOutput } from "@salvador/shared";
import { VERTEX_PROJECT, VERTEX_REGION, CALLB_MODEL } from "../config/vertex.js";
import { loadPrompt } from "../prompts/loader.js";
import type { TagDefinition } from "@salvador/shared";
import { MATRIX_EVALUATOR_ADDENDUM } from "./matrixConstants.js";
import { retryOnQuota } from "./vertexRetry.js";
import { parseTolerantEvaluatorOutput, formatCallBSummary } from "./callBParse.js";

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

  // Call B was landing in EMPTY_OUTPUT on ~4-16% of turns because a strict
  // Zod parse failed the whole payload whenever flash-lite omitted a
  // non-essential field on a single tag (baseline v0 + 30d of dev logs).
  // Timeout is 30s per attempt — the OAuth path used to hang 5min silently.
  const result = await retryOnQuota(() => model.generateContent(prompt), {
    label: "callB",
    timeoutMs: 30_000,
  });
  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  let rawJson = "";
  for (const part of parts) {
    if (typeof part.text === "string") rawJson += part.text;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(rawJson));
  } catch (err) {
    console.warn(
      `[COACH B] JSON parse failed — turn skipped. raw=${rawJson.slice(0, 500)} err=${(err as Error).message}`,
    );
    return EMPTY_OUTPUT;
  }

  const tolerant = parseTolerantEvaluatorOutput(parsed);
  console.log(formatCallBSummary(tolerant));
  if (!tolerant.strictOk) {
    // Per-issue path list makes it easy to grep "which field is flash-lite
    // dropping today". Truncated so a bad payload doesn't spam the log.
    console.warn(
      "[COACH B] strict validation would have failed — issues:",
      tolerant.strictIssues.slice(0, 20),
    );
  }
  if (tolerant.discardedTags.length > 0) {
    console.warn("[COACH B] discarded tags:", tolerant.discardedTags);
  }
  return tolerant.output;
}
