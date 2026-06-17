import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  ConversationTurnSchema,
  TagDefinitionSchema,
  ScenarioSchema,
  SimulationModeSchema,
  type TagDefinition,
  type Scenario,
  type EmotionalStateVariables,
  type EstadoMatriz,
} from "@salvador/shared";
import { db } from "../config/firebase.js";
import { runSafetyPipeline } from "../safety/safetyPipeline.js";
import { classifyMessage } from "../safety/llmClassifier.js";
import { getTemplate } from "../safety/templates.js";
import { runCallA } from "./callA.js";
import { runCallB } from "./callB.js";
import { accumulateTags } from "./tagAccumulator.js";
import { applyMatrixDelta, persistMatrixUpdate, readMatrixState } from "./matrixEngine.js";
import { INITIAL_ESTADO_MATRIZ } from "./matrixConstants.js";
import { maybeStartTimer, computeTimerState, isTimerExpired, overrideTimer } from "../session/timerService.js";
import { createSessionManager } from "../session/sessionManager.js";
import { randomUUID } from "node:crypto";

const EmotionalStateSchema = z.object({
  emotionalIntensity: z.number().min(1).max(10),
  openness: z.number().min(1).max(10),
  trustInHelp: z.number().min(1).max(10),
});

const CoachTurnRequestSchema = z.object({
  traineeMessage: z.string().min(1).max(2000),
  sessionId: z.string(),
  scenarioId: z.string(),
  turnNumber: z.number().int().nonnegative(),
  conversationHistory: z.array(ConversationTurnSchema).max(20).default([]),
  emotionalState: EmotionalStateSchema,
  pendingTagIds: z.array(z.string()).default([]),
  modo: SimulationModeSchema.default("escenario"),
});

async function loadScenario(scenarioId: string): Promise<Scenario | null> {
  const snap = await db.collection("scenarios").doc(scenarioId).get();
  if (!snap.exists) return null;
  const parsed = ScenarioSchema.safeParse({ id: snap.id, ...snap.data() });
  if (!parsed.success) {
    console.error(`[COACH] Scenario ${scenarioId} failed schema validation`, parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

async function loadTagDefinitions(tagIds: string[]): Promise<TagDefinition[]> {
  if (tagIds.length === 0) return [];
  const snaps = await Promise.all(
    tagIds.map((id) => db.collection("tag_definitions").doc(id).get())
  );
  const defs: TagDefinition[] = [];
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const parsed = TagDefinitionSchema.safeParse({ tagId: snap.id, ...snap.data() });
    if (parsed.success) defs.push(parsed.data);
    else console.error(`[COACH] TagDefinition ${snap.id} failed validation`, parsed.error.flatten());
  }
  return defs;
}

function buildScenarioContextSummary(scenario: Scenario, emotionalState: EmotionalStateVariables): string {
  return [
    `Personaje: ${scenario.persona.name}, ${scenario.persona.age} años. ${scenario.persona.role}.`,
    `Situación inicial: ${scenario.initialSituation}`,
    `Estado emocional actual — intensidad: ${emotionalState.emotionalIntensity}/10, apertura: ${emotionalState.openness}/10, confianza en la ayuda: ${emotionalState.trustInHelp}/10`,
  ].join("\n");
}

const COACH_PROMPT_VERSION = "coach_conversational_v1";

export const coachTurn = onCall(
  { region: "southamerica-west1", invoker: "public", timeoutSeconds: 180, memory: "512MiB" },
  async (request: CallableRequest) => {
    const userId = request.auth?.uid;
    if (userId === undefined) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const parsed = CoachTurnRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid request data");
    }
    const {
      traineeMessage,
      sessionId,
      scenarioId,
      turnNumber,
      conversationHistory,
      emotionalState,
      pendingTagIds,
      modo,
    } = parsed.data;

    const sessionManager = createSessionManager();
    const turnStart = Date.now();

    await sessionManager.createSession({
      sessionId,
      userId,
      scenarioId,
      mode: "coach",
      promptVersion: COACH_PROMPT_VERSION,
    });

    // Safety pipeline runs FIRST — before any LLM or matrix calls.
    const safetyResult = await runSafetyPipeline({
      message: traineeMessage,
      lastTurns: conversationHistory,
      sessionId,
      mode: "coach",
      frameBreakSuspected: false,
    });

    if (!safetyResult.isSafe && safetyResult.template !== null) {
      const crisisReply = getTemplate(safetyResult.template);
      const safetyLayer = safetyResult.layer as "L2" | "L3";
      await Promise.all([
        sessionManager.appendMessage({
          sessionId,
          role: "user",
          content: traineeMessage,
          turnNumber,
          safetyLayerTriggered: safetyLayer,
          promptVersion: COACH_PROMPT_VERSION,
        }),
        sessionManager.appendMessage({
          sessionId,
          role: "assistant",
          content: crisisReply,
          turnNumber: turnNumber + 1,
          promptVersion: COACH_PROMPT_VERSION,
        }),
      ]);
      await sessionManager.markCrisisInterrupted(sessionId);
      return {
        reply: crisisReply,
        safe: false,
        safetyLayer: safetyResult.layer,
        frameBreakSuspected: false,
        tagUpdates: 0,
        estadoMatriz: null,
        timerState: null,
        latenciaMs: null,
      };
    }

    // Start session timer on the first user turn (idempotent).
    const sesionIniciadaEn = await maybeStartTimer(sessionId);

    // Check if time has expired (hard cutoff, unless overridden by admin).
    const sessionSnap = await db.collection("sessions").doc(sessionId).get();
    const cronometroAnulado = (sessionSnap.data() as Record<string, unknown>)?.["cronometroAnulado"] === true;
    const timerState = computeTimerState(sesionIniciadaEn, cronometroAnulado);

    if (isTimerExpired(timerState)) {
      await sessionManager.completeSession(sessionId);
      return {
        reply: null,
        safe: true,
        safetyLayer: null,
        frameBreakSuspected: false,
        tagUpdates: 0,
        estadoMatriz: null,
        timerState,
        timerExpired: true,
        latenciaMs: null,
      };
    }

    // Read current matrix state (for escenario mode only).
    let currentMatrix: EstadoMatriz | null = null;
    if (modo === "escenario") {
      currentMatrix = await readMatrixState(sessionId, INITIAL_ESTADO_MATRIZ);
    }

    // Load scenario + tag definitions in parallel.
    const [scenario, tagDefinitions] = await Promise.all([
      loadScenario(scenarioId),
      loadTagDefinitions(pendingTagIds),
    ]);

    if (scenario === null) {
      throw new HttpsError("not-found", `Scenario ${scenarioId} not found`);
    }

    // Use server-authoritative matrix state for Call A's emotional context.
    const callAEmotionalState = currentMatrix !== null
      ? {
          emotionalIntensity: currentMatrix.intensidadEmocional,
          openness: currentMatrix.apertura,
          trustInHelp: currentMatrix.confianzaEnLaAyuda,
        }
      : emotionalState;

    const callAInput = {
      scenario,
      emotionalState: callAEmotionalState,
      conversationHistory,
      traineeMessage,
      promptVersion: COACH_PROMPT_VERSION,
    };

    const callBInput = {
      pendingTags: tagDefinitions,
      scenarioContextSummary: buildScenarioContextSummary(scenario, callAEmotionalState),
      conversationHistory,
      traineeTurn: traineeMessage,
      promptVersion: "coach_evaluator_v1",
    };

    // Call A (Martina's reply) runs first and its result is awaited before responding.
    // Call B (evaluator) fires immediately after and runs fire-and-forget — the user
    // receives Martina's reply in ~2s; tags and matrix bars update ~2-3s later via
    // Firestore. This is the primary latency optimization for the formative demo.
    // Tradeoff: if the function container is recycled before Call B finishes, that
    // turn's evaluation is lost. Acceptable for demo; revisit for production.
    // See debt/0017-callb-fire-and-forget.md.
    const callAStart = Date.now();
    const callAResult = await runCallA(callAInput, modo);
    const callALatency = callAResult.latencyMs;

    // Fire Call B without awaiting — updates Firestore in background.
    const callBStart = Date.now();
    const callBPromise = (
      modo === "escenario"
        ? runCallB(callBInput, true)
        : runCallB(callBInput, false)
    ).then(async (callBResult) => {
      const callBLatency = Date.now() - callBStart;
      const latenciaMs = {
        personaje: callALatency,
        evaluador: callBLatency,
        total: Date.now() - turnStart,
      };
      console.log(`[COACH] Turn ${turnNumber} latency — personaje: ${latenciaMs.personaje}ms, evaluador: ${latenciaMs.evaluador}ms, total: ${latenciaMs.total}ms`);

      if (modo === "escenario" && currentMatrix !== null && callBResult.matrixDelta !== undefined) {
        const newMatrix = applyMatrixDelta(currentMatrix, callBResult.matrixDelta);
        const turnoId = randomUUID();
        await persistMatrixUpdate({
          sessionId,
          turnoId,
          newState: newMatrix,
          delta: callBResult.matrixDelta,
          latency: latenciaMs,
          rol: "usuario",
          contenido: traineeMessage,
        });
      }

      await accumulateTags({
        sessionId,
        evaluatorOutput: callBResult,
        pendingTags: tagDefinitions,
        turnNumber,
      });
    }).catch((err: unknown) => {
      console.error(`[COACH] Call B background error on turn ${turnNumber}:`, err);
    });

    // Keep a reference so Cloud Functions doesn't GC the promise before it resolves.
    void callBPromise;

    const latenciaMs = {
      personaje: callALatency,
      evaluador: 0, // unknown at response time — logged async
      total: Date.now() - turnStart,
    };

    // Matrix state for this response is the pre-turn state (Call B hasn't resolved yet).
    // The client will receive updated bars on the next turn via the callable response.
    const newMatrix: EstadoMatriz | null = null;

    // Layer 2: handle frame-break detected by Call A.
    let frameBreakHandled = false;
    if (callAResult.frameBreakSuspected) {
      const l2Result = await classifyMessage({
        message: traineeMessage,
        lastTurns: conversationHistory,
        mode: "coach",
      });

      if (l2Result === "S" || l2Result === "D") {
        const template = l2Result === "S" ? "REAL_DISTRESS" : "FRAME_BREAK";
        const crisisReply = getTemplate(template);
        await Promise.all([
          sessionManager.appendMessage({
            sessionId,
            role: "user",
            content: traineeMessage,
            turnNumber,
            evaluatorOutput: { evaluated_tags: [] }, // Call B result arrives async
            safetyLayerTriggered: "L2",
            promptVersion: COACH_PROMPT_VERSION,
          }),
          sessionManager.appendMessage({
            sessionId,
            role: "assistant",
            content: crisisReply,
            turnNumber: turnNumber + 1,
            promptVersion: COACH_PROMPT_VERSION,
          }),
        ]);
        await sessionManager.markCrisisInterrupted(sessionId);
        return {
          reply: crisisReply,
          safe: false,
          safetyLayer: "L2",
          frameBreakSuspected: true,
          tagUpdates: 0,
          estadoMatriz: currentMatrix,
          timerState: computeTimerState(sesionIniciadaEn, cronometroAnulado),
          latenciaMs,
        };
      }
      frameBreakHandled = true;
    }

    // Persist the normal turn pair. evaluatorOutput is empty here — Call B
    // writes tag scores and matrix directly to Firestore in the background.
    await Promise.all([
      sessionManager.appendMessage({
        sessionId,
        role: "user",
        content: traineeMessage,
        turnNumber,
        evaluatorOutput: { evaluated_tags: [] },
        promptVersion: COACH_PROMPT_VERSION,
      }),
      sessionManager.appendMessage({
        sessionId,
        role: "assistant",
        content: callAResult.content,
        turnNumber: turnNumber + 1,
        promptVersion: COACH_PROMPT_VERSION,
      }),
    ]);

    // Persist modo to session doc (idempotent — first turn sets it, subsequent turns confirm).
    await db.collection("sessions").doc(sessionId).set({ modo }, { merge: true });

    return {
      reply: callAResult.content,
      safe: true,
      safetyLayer: null,
      frameBreakSuspected: callAResult.frameBreakSuspected && !frameBreakHandled,
      tagUpdates: 0, // unknown at response time — Call B running async
      estadoMatriz: currentMatrix, // matrix updated async; client sees new state next turn
      timerState: computeTimerState(sesionIniciadaEn, cronometroAnulado),
      latenciaMs,
    };
  }
);

// Admin-only callable to override (disable/re-enable) the session timer.
const TimerOverrideRequestSchema = z.object({
  sessionId: z.string(),
  anular: z.boolean(),
});

export const timerOverride = onCall(
  { region: "southamerica-west1", invoker: "public" },
  async (request: CallableRequest) => {
    const userId = request.auth?.uid;
    if (userId === undefined) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    // Verify admin role.
    const userSnap = await db.collection("users").doc(userId).get();
    const role = (userSnap.data() as { role?: string } | undefined)?.role;
    if (role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required");
    }

    const parsed = TimerOverrideRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid request data");
    }

    await overrideTimer(parsed.data.sessionId, parsed.data.anular);
    return { success: true, cronometroAnulado: parsed.data.anular };
  }
);
