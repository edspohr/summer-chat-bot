// labChatHandler.ts — Latency Lab HTTP callable Cloud Function
//
// Dev-only tool. Not imported by production handlers. Reuses pure utilities:
// safetyPipeline, loader, ragRetriever, embeddings (via retrieveTopK).
//
// Debt: docs/debt/0009-promptbuilder-stub-divergence.md
//       docs/debt/0010-lab-sessions-firestore-rules.md
//       docs/debt/0011-matias-scenario-missing.md

import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";
import type { SafetySetting } from "@google-cloud/vertexai";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { db } from "../config/firebase.js";
import { VERTEX_PROJECT, VERTEX_REGION, GEMINI_MODEL } from "../config/vertex.js";
import { runSafetyPipeline } from "../safety/safetyPipeline.js";
import { getTemplate } from "../safety/templates.js";
import { loadPrompt } from "../prompts/loader.js";
import { retrieveTopK } from "../mentor/ragRetriever.js";
import { calculateCostUsd } from "../config/pricing.js";
import { processGeminiStream } from "./streamProcessor.js";
import {
  LabRequestSchema,
  LabResponseSchema,
  ScenarioSchema,
  type LabResponse,
  type KnowledgeChunk,
  type Scenario,
  type EstadoMatriz,
} from "@salvador/shared";
import { runCallB } from "../coach/callB.js";
import { applyMatrixDelta, readMatrixState } from "../coach/matrixEngine.js";
import { INITIAL_ESTADO_MATRIZ } from "../coach/matrixConstants.js";
import { initialMatrixFor, MARTINA_INITIAL_MATRIX } from "@salvador/shared";

// Safety settings applied to all Gemini calls — NON-NEGOTIABLE per architecture spec.
// Same as production: BLOCK_ONLY_HIGH on DANGEROUS_CONTENT prevents empty responses
// when the conversation involves crisis/self-harm content (the training domain).
// Types extracted from SafetySetting to avoid depending on enum exports (version-safe).
type HarmCat = SafetySetting["category"];
type HarmThresh = SafetySetting["threshold"];
const GEMINI_SAFETY_SETTINGS: SafetySetting[] = [
  { category: "HARM_CATEGORY_HARASSMENT" as HarmCat, threshold: "BLOCK_ONLY_HIGH" as HarmThresh },
  { category: "HARM_CATEGORY_HATE_SPEECH" as HarmCat, threshold: "BLOCK_ONLY_HIGH" as HarmThresh },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as HarmCat, threshold: "BLOCK_MEDIUM_AND_ABOVE" as HarmThresh },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT" as HarmCat, threshold: "BLOCK_ONLY_HIGH" as HarmThresh },
];

const MENTOR_COLLECTIONS = [
  "base_tag",
  "scenario_tag",
  "theoretical_framework",
] as const;

// ── Prompt builder (private to this module) ────────────────────────────────
// Mirrors the logic in callA.ts and mentorHandler.ts but scoped to lab modes.
// Does NOT depend on the stub promptBuilder.ts — see debt 0009.

interface BuiltLabPrompt {
  systemPrompt: string;
  userContent: string;
  contextInjected: boolean;
  ragChunksUsed: number;
}

function formatHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>
): string {
  if (history.length === 0) return "(Sin historial previo en esta sesión)";
  return history
    .map((t) => `${t.role === "user" ? "Usuario" : "Asistente"}: ${t.content}`)
    .join("\n\n");
}

function formatRagContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) {
    return "(No se encontraron fragmentos relevantes en la base de conocimiento)";
  }
  return chunks
    .map((c, i) => `[Fragmento ${i + 1} — ${c.collection}]\n${c.content}`)
    .join("\n\n---\n\n");
}

async function buildMentorPrompt(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
): Promise<BuiltLabPrompt & { chunks: KnowledgeChunk[] }> {
  const template = await loadPrompt("mentor_v1");
  const chunks = await retrieveTopK({
    query: userMessage,
    collections: [...MENTOR_COLLECTIONS],
    topK: 5,
  });

  const systemPrompt = template
    .replace("[CONVERSATION_HISTORY]", formatHistory(history))
    .replace("[RAG_CONTEXT]", formatRagContext(chunks))
    .replace(
      "[USER_MESSAGE]",
      "(el mensaje del usuario está en el contenido del turno)"
    );

  return {
    systemPrompt,
    userContent: userMessage,
    contextInjected: true,
    ragChunksUsed: chunks.length,
    chunks,
  };
}

async function buildCoachRawPrompt(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
): Promise<BuiltLabPrompt> {
  const template = await loadPrompt("coach_conversational_v1");

  // Inject history only — no scenario block, no character definition, no emotional state.
  // This isolates the contribution of context injection in latency and quality comparisons.
  const systemPrompt = template
    .replace("[CHARACTER_NAME]", "[CHARACTER_NAME]") // left as placeholder
    .replace("[TRAINEE_RELATIONSHIP]", "[TRAINEE_RELATIONSHIP]")
    .replace("[CHARACTER_PERSONA]", "(No context injected — raw mode)")
    .replace("[INITIAL_SITUATION]", "(No context injected — raw mode)")
    .replace("[EMOTIONAL_STATE_VARIABLES]", "(No context injected — raw mode)")
    .replace("[CHARACTER_BEHAVIOR_RULES]", "(No context injected — raw mode)")
    .replace("[SCENARIO_BLOCK]", "(No context injected — raw mode)")
    .replace("[CONVERSATION_HISTORY]", formatHistory(history))
    .replace("[TRAINEE_MESSAGE]", "(el mensaje del aprendiz está en el contenido del turno)");

  return {
    systemPrompt,
    userContent: userMessage,
    contextInjected: false,
    ragChunksUsed: 0,
  };
}

async function buildCoachContextPrompt(
  scenario: Scenario,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
): Promise<BuiltLabPrompt> {
  const template = await loadPrompt("coach_conversational_v1");

  const personaBlock = [
    `Nombre: ${scenario.persona.name}, ${scenario.persona.age} años`,
    `Rol respecto al aprendiz: ${scenario.persona.role}`,
    `Rasgos de personalidad: ${scenario.persona.traits.join(", ")}`,
    `Estilo comunicacional: ${scenario.persona.communicationStyle}`,
    `Estado emocional base: ${scenario.persona.emotionalBaseline}`,
  ].join("\n");

  // Prompt scaffold reads the canonical initial matrix (same source the
  // engine falls back to), not the scenario doc's emotionalStateVariables
  // field — see docs/debt/0022.
  const canonicalInitial = initialMatrixFor(scenario.id) ?? MARTINA_INITIAL_MATRIX;
  const emotionalStateBlock = [
    `emotional_intensity: ${canonicalInitial.intensidadEmocional} / 10`,
    `openness: ${canonicalInitial.apertura} / 10`,
    `trust_in_help: ${canonicalInitial.confianzaEnLaAyuda} / 10`,
  ].join("\n");

  const historyText =
    history.length === 0
      ? "(Inicio de la conversación — sin historial previo)"
      : history
          .map(
            (t) =>
              `${t.role === "user" ? "Aprendiz" : scenario.persona.name}: ${t.content}`
          )
          .join("\n\n");

  const systemPrompt = template
    .replaceAll("[CHARACTER_NAME]", scenario.persona.name)
    .replace("[TRAINEE_RELATIONSHIP]", scenario.persona.role)
    .replace("[CHARACTER_PERSONA]", personaBlock)
    .replace("[INITIAL_SITUATION]", scenario.initialSituation)
    .replace("[EMOTIONAL_STATE_VARIABLES]", emotionalStateBlock)
    .replace("[CHARACTER_BEHAVIOR_RULES]", scenario.characterInstructions)
    .replace("[SCENARIO_BLOCK]", scenario.description)
    .replace("[CONVERSATION_HISTORY]", historyText)
    .replace(
      "[TRAINEE_MESSAGE]",
      "(el mensaje del aprendiz está en el contenido del turno)"
    );

  return {
    systemPrompt,
    userContent: userMessage,
    contextInjected: true,
    ragChunksUsed: 0,
  };
}

// ── Scenario loader ────────────────────────────────────────────────────────

async function loadScenarioBySlug(slug: string): Promise<Scenario | null> {
  const snap = await db.collection("scenarios").doc(slug).get();
  if (!snap.exists) return null;
  const parsed = ScenarioSchema.safeParse({ id: snap.id, ...snap.data() });
  if (!parsed.success) {
    console.error(
      `[LAB] Scenario ${slug} failed schema validation`,
      parsed.error.flatten()
    );
    return null;
  }
  return parsed.data;
}

// ── Response builders ──────────────────────────────────────────────────────

function buildUnavailableResponse(
  message: string,
  sessionId: string,
  messageId: string,
  startTime: number,
  mode: string,
  promptVersion: string
): LabResponse {
  return LabResponseSchema.parse({
    content: message,
    metrics: {
      totalLatencyMs: Date.now() - startTime,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      safetyLayerTriggered: null,
      geminiModel: GEMINI_MODEL,
      promptVersion,
      region: "us-central1",
      mode,
    },
    promptSnapshot: {
      systemPromptLength: 0,
      contextInjected: false,
      ragChunksUsed: 0,
      totalPromptTokensEstimated: 0,
    },
    sessionId,
    messageId,
    timestamp: new Date().toISOString(),
  });
}

function buildSafetyResponse(
  templateContent: string,
  safetyLayer: string,
  sessionId: string,
  messageId: string,
  startTime: number,
  mode: string,
  promptVersion: string
): LabResponse {
  return LabResponseSchema.parse({
    content: templateContent,
    metrics: {
      totalLatencyMs: Date.now() - startTime,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      safetyLayerTriggered: safetyLayer,
      geminiModel: GEMINI_MODEL,
      promptVersion,
      region: "us-central1",
      mode,
    },
    promptSnapshot: {
      systemPromptLength: 0,
      contextInjected: false,
      ragChunksUsed: 0,
      totalPromptTokensEstimated: 0,
    },
    sessionId,
    messageId,
    timestamp: new Date().toISOString(),
  });
}

// ── Firestore persistence ──────────────────────────────────────────────────

async function persistLabInteraction(
  sessionId: string,
  messageId: string,
  response: LabResponse,
  sessionLabel: string | undefined
): Promise<void> {
  const sessionRef = db.collection("lab_sessions").doc(sessionId);
  const messageRef = sessionRef.collection("messages").doc(messageId);

  const responseData = LabResponseSchema.parse(response);

  const batch = db.batch();

  batch.set(
    sessionRef,
    {
      label: sessionLabel ?? "",
      mode: response.metrics.mode,
      scenario: null,
      startedAt: FieldValue.serverTimestamp(),
      lastActivityAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(messageRef, {
    ...responseData,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function labChatHandler(
  request: CallableRequest
): Promise<LabResponse> {
  const userId = request.auth?.uid;
  if (userId === undefined) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const parsed = LabRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid request data");
  }
  const {
    message,
    mode,
    simulationMode,
    scenario,
    conversationHistory,
    promptVersion,
    sessionLabel,
  } = parsed.data;

  // sessionId is managed by the frontend and passed as extra field not in LabRequestSchema.
  // If not provided (e.g. first message), generate a new one.
  // Debt: the sessionId coupling between client and server is undocumented in the shared schema.
  const rawData = request.data as Record<string, unknown>;
  const sessionId =
    typeof rawData["sessionId"] === "string" ? rawData["sessionId"] : randomUUID();
  const messageId = randomUUID();
  const startTime = Date.now();

  // Convert lab history (no turnNumber) to SafetyCheckInput format (requires turnNumber)
  const lastTurns = conversationHistory.slice(-2).map((t, i) => ({
    role: t.role,
    content: t.content,
    turnNumber: i,
  }));

  // Safety pipeline ALWAYS runs first — testing layer behavior is the lab's purpose.
  const safetyResult = await runSafetyPipeline({
    message,
    lastTurns,
    sessionId,
    mode: mode === "mentor" ? "mentor" : "coach",
    frameBreakSuspected: false,
  });

  if (!safetyResult.isSafe && safetyResult.template !== null) {
    const templateContent = getTemplate(safetyResult.template);
    const layer = safetyResult.layer ?? "L3";
    const response = buildSafetyResponse(
      templateContent,
      layer,
      sessionId,
      messageId,
      startTime,
      mode,
      promptVersion
    );
    await persistLabInteraction(sessionId, messageId, response, sessionLabel);
    return response;
  }

  // Matías unavailable in coach_context mode
  if (mode === "coach_context" && scenario === "matias") {
    const response = buildUnavailableResponse(
      "Escenario Matías aún no está disponible en modo Coach con contexto. Usa modo Coach sin contexto o selecciona Camila.",
      sessionId,
      messageId,
      startTime,
      mode,
      promptVersion
    );
    await persistLabInteraction(sessionId, messageId, response, sessionLabel);
    return response;
  }

  // Build prompt based on mode + simulationMode
  let builtPrompt: BuiltLabPrompt;
  let scenarioDoc: Scenario | null = null;

  if (mode === "mentor") {
    builtPrompt = await buildMentorPrompt(conversationHistory, message);
  } else if (mode === "coach_raw" || simulationMode === "promptPuro") {
    // promptPuro uses the pure-prompt template regardless of coach_raw vs coach_context
    builtPrompt = await buildCoachRawPrompt(conversationHistory, message);
  } else {
    // coach_context + escenario — requires scenario
    if (scenario === undefined) {
      throw new HttpsError(
        "invalid-argument",
        "scenario is required for coach_context mode"
      );
    }
    scenarioDoc = await loadScenarioBySlug(scenario);
    if (scenarioDoc === null) {
      throw new HttpsError("not-found", `Scenario ${scenario} not found`);
    }
    builtPrompt = await buildCoachContextPrompt(
      scenarioDoc,
      conversationHistory,
      message
    );
  }

  // temperature 0.85 per spec for character calls; 0.7 for mentor
  const temperature = mode === "mentor" ? 0.7 : 0.85;

  // Gemini character call with stream — safety settings NON-NEGOTIABLE per architecture spec
  const vertexAI = new VertexAI({ project: VERTEX_PROJECT, location: VERTEX_REGION });
  const model = vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: builtPrompt.systemPrompt,
    // 120 tokens cap for character; 1024 for mentor (longer explanations expected)
    generationConfig: mode === "mentor"
      ? { temperature, maxOutputTokens: 1024 }
      : { temperature, topP: 0.95, maxOutputTokens: 120 },
    safetySettings: GEMINI_SAFETY_SETTINGS,
  });

  // Read current matrix state if we will run the evaluator
  const runMatrix = mode === "coach_context" && simulationMode === "escenario" && scenarioDoc !== null;
  const currentMatrixP: Promise<EstadoMatriz> = runMatrix
    ? readMatrixState(sessionId, INITIAL_ESTADO_MATRIZ)
    : Promise.resolve(INITIAL_ESTADO_MATRIZ);

  const characterCallStart = Date.now();
  const streamResultP = model.generateContentStream(builtPrompt.userContent);

  // Fire matrix evaluator in parallel with character stream (escenario + coach_context only)
  const evaluatorP = runMatrix && scenarioDoc !== null
    ? (async () => {
        const evalStart = Date.now();
        const historyTurns = conversationHistory.map((t, i) => ({
          role: t.role as "user" | "assistant",
          content: t.content,
          turnNumber: i,
        }));
        const result = await runCallB(
          {
            pendingTags: [],
            scenarioContextSummary: `Personaje: ${scenarioDoc?.persona.name ?? ""}. Escenario de entrenamiento OASIS.`,
            conversationHistory: historyTurns,
            traineeTurn: message,
            promptVersion: "coach_evaluator_v1",
          },
          true, // includeMatrix = true
        );
        return { result, latencyMs: Date.now() - evalStart };
      })()
    : Promise.resolve(null);

  const streamResult = await streamResultP;
  let firstTokenLatencyMs: number | undefined;
  let contentBuffer = "";
  let streamError: Error | undefined;

  await processGeminiStream(streamResult.stream, startTime, {
    onFirstChunk: (chunk, latencyMs) => {
      firstTokenLatencyMs = latencyMs;
      contentBuffer += chunk;
    },
    onChunk: (chunk) => {
      contentBuffer += chunk;
    },
    onComplete: (_usage, _totalMs) => {
      // Token counts are retrieved from streamResult.response below for accuracy
    },
    onError: (err) => {
      streamError = err;
    },
  });

  if (streamError !== undefined) {
    console.error("[LAB] Stream error", streamError);
    throw new HttpsError("internal", "Gemini stream failed");
  }

  const characterLatencyMs = Date.now() - characterCallStart;
  const totalLatencyMs = Date.now() - startTime;

  // Resolve evaluator and matrix state (may already be settled — parallel)
  const [evalResult, currentMatrix] = await Promise.all([evaluatorP, currentMatrixP]);

  let estadoMatriz: EstadoMatriz | null = null;
  if (runMatrix && evalResult !== null && evalResult.result.matrixDelta !== undefined) {
    estadoMatriz = applyMatrixDelta(currentMatrix, evalResult.result.matrixDelta);
    // Persist matrix state to lab_sessions (best-effort)
    db.collection("lab_sessions").doc(sessionId).set(
      { estadoMatriz, ultimaActualizacion: new Date().toISOString() },
      { merge: true },
    ).catch((err) => console.error("[LAB] Matrix persist error", err));
  }

  // Accurate token counts from the aggregated response Promise.
  // By the time processGeminiStream resolves, streamResult.response is already settled.
  // Debt: docs/debt/0008-first-token-latency.md — token count source documented there.
  const finalResponse = await streamResult.response;
  const inputTokens = finalResponse.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = finalResponse.usageMetadata?.candidatesTokenCount ?? 0;
  const estimatedCostUsd = calculateCostUsd(inputTokens, outputTokens);

  // Log per-turn latency for admin observability
  console.log(`[LAB] Turn latency — character: ${characterLatencyMs}ms, evaluator: ${evalResult?.latencyMs ?? 0}ms, total: ${totalLatencyMs}ms`);

  // Rough token estimate for prompt snapshot: 4 chars per token
  const totalPromptTokensEstimated = Math.ceil(
    (builtPrompt.systemPrompt.length + builtPrompt.userContent.length) / 4
  );

  const response = LabResponseSchema.parse({
    content: contentBuffer,
    metrics: {
      totalLatencyMs,
      firstTokenLatencyMs,
      characterLatencyMs,
      evaluatorLatencyMs: evalResult?.latencyMs,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      safetyLayerTriggered: null,
      geminiModel: GEMINI_MODEL,
      promptVersion,
      region: "us-central1",
      mode,
      simulationMode,
    },
    promptSnapshot: {
      systemPromptLength: builtPrompt.systemPrompt.length,
      contextInjected: builtPrompt.contextInjected,
      ragChunksUsed: builtPrompt.ragChunksUsed,
      totalPromptTokensEstimated,
    },
    sessionId,
    messageId,
    timestamp: new Date().toISOString(),
    estadoMatriz,
  });

  await persistLabInteraction(sessionId, messageId, response, sessionLabel);

  return response;
}
