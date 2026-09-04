import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";
import { z } from "zod";
import { ConversationTurnSchema } from "@salvador/shared";
import { VERTEX_PROJECT, VERTEX_REGION, GEMINI_MODEL } from "../config/vertex.js";
import { runSafetyPipeline } from "../safety/safetyPipeline.js";
import { getTemplate } from "../safety/templates.js";
import { retrieveTopK } from "./ragRetriever.js";
import { loadPrompt } from "../prompts/loader.js";
import { createSessionManager } from "../session/sessionManager.js";
import type { KnowledgeChunk } from "@salvador/shared";

const MentorChatRequestSchema = z.object({
  userMessage: z.string().min(1).max(2000),
  sessionId: z.string(),
  scenarioId: z.string().default("mentor"),
  turnNumber: z.number().int().nonnegative().default(0),
  conversationHistory: z.array(ConversationTurnSchema).max(20).default([]),
});

const MENTOR_COLLECTIONS = ["base_tag", "scenario_tag", "theoretical_framework"] as const;
const RAG_TOP_K = 5;
const MENTOR_PROMPT_VERSION = "mentor_v1";

function formatHistory(history: z.infer<typeof ConversationTurnSchema>[]): string {
  if (history.length === 0) return "(Sin historial previo en esta sesión)";
  return history
    .map((t) => `${t.role === "user" ? "Usuario" : "Summer ChatBot"}: ${t.content}`)
    .join("\n\n");
}

function formatRagContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) {
    return "(No se encontraron fragmentos relevantes en la base de conocimiento para esta pregunta)";
  }
  return chunks
    .map((c, i) => `[Fragmento ${i + 1} — ${c.collection}]\n${c.content}`)
    .join("\n\n---\n\n");
}

function extractResponseText(
  result: Awaited<ReturnType<ReturnType<VertexAI["getGenerativeModel"]>["generateContent"]>>
): string {
  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  let text = "";
  for (const part of parts) {
    if (typeof part.text === "string") text += part.text;
  }
  return text.trim();
}

export const mentorChat = onCall(
  {
    region: "southamerica-west1",
    invoker: "public",
    // Kept warm for GORE event 2026-09-04 to avoid first-hit cold starts.
    // Safe to remove once event traffic subsides.
    minInstances: 1,
  },
  async (request: CallableRequest) => {
    const userId = request.auth?.uid;
    if (userId === undefined) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const parsed = MentorChatRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid request data");
    }
    const { userMessage, sessionId, scenarioId, turnNumber, conversationHistory } = parsed.data;

    const sessionManager = createSessionManager();

    // Ensure session exists in Firestore (idempotent on subsequent turns).
    await sessionManager.createSession({
      sessionId,
      userId,
      scenarioId,
      mode: "mentor",
      promptVersion: MENTOR_PROMPT_VERSION,
    });

    // Layer 3 + Layer 2 safety check (mentor mode: L3 always, L2 only on frameBreakSuspected)
    const safetyResult = await runSafetyPipeline({
      message: userMessage,
      lastTurns: conversationHistory,
      sessionId,
      mode: "mentor",
      frameBreakSuspected: false,
    });

    if (!safetyResult.isSafe && safetyResult.template !== null) {
      const crisisReply = getTemplate(safetyResult.template);
      const safetyLayer = safetyResult.layer as "L2" | "L3";
      await Promise.all([
        sessionManager.appendMessage({
          sessionId,
          role: "user",
          content: userMessage,
          turnNumber,
          safetyLayerTriggered: safetyLayer,
          promptVersion: MENTOR_PROMPT_VERSION,
        }),
        sessionManager.appendMessage({
          sessionId,
          role: "assistant",
          content: crisisReply,
          turnNumber: turnNumber + 1,
          promptVersion: MENTOR_PROMPT_VERSION,
        }),
      ]);
      await sessionManager.markCrisisInterrupted(sessionId);
      return {
        reply: crisisReply,
        safe: false,
        safetyLayer: safetyResult.layer,
        ragChunksUsed: 0,
      };
    }

    // RAG: embed query → retrieve top-5 chunks from knowledge base
    const chunks = await retrieveTopK({
      query: userMessage,
      collections: [...MENTOR_COLLECTIONS],
      topK: RAG_TOP_K,
    });

    // Assemble the prompt from the versioned template
    const promptTemplate = await loadPrompt(MENTOR_PROMPT_VERSION);
    const systemInstruction = promptTemplate
      .replace("[CONVERSATION_HISTORY]", formatHistory(conversationHistory))
      .replace("[RAG_CONTEXT]", formatRagContext(chunks))
      .replace("[USER_MESSAGE]", "(el mensaje del usuario está en el contenido del turno)");

    // Single Gemini call — temperature 0.7 per architecture
    const vertexAI = new VertexAI({ project: VERTEX_PROJECT, location: VERTEX_REGION });
    const model = vertexAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    });

    const geminiResult = await model.generateContent(userMessage);
    const reply = extractResponseText(geminiResult);

    // Persist both turns to Firestore for audit trail.
    await Promise.all([
      sessionManager.appendMessage({
        sessionId,
        role: "user",
        content: userMessage,
        turnNumber,
        promptVersion: MENTOR_PROMPT_VERSION,
      }),
      sessionManager.appendMessage({
        sessionId,
        role: "assistant",
        content: reply,
        turnNumber: turnNumber + 1,
        promptVersion: MENTOR_PROMPT_VERSION,
      }),
    ]);

    return {
      reply,
      safe: true,
      safetyLayer: null,
      ragChunksUsed: chunks.length,
    };
  }
);
