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
  type SafetyClassification,
} from "@salvador/shared";
import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { loadRuntimeConfig } from "../config/runtimeConfig.js";
import { runSafetyPipeline } from "../safety/safetyPipeline.js";
import { classifyMessage } from "../safety/llmClassifier.js";
import { getTemplate } from "../safety/templates.js";
import { runCallA } from "./callA.js";
import { runCallB } from "./callB.js";
import { retryOnQuota } from "./vertexRetry.js";
import { accumulateTags } from "./tagAccumulator.js";
import { applyMatrixDelta, persistMatrixUpdate, readMatrixState } from "./matrixEngine.js";
import { INITIAL_ESTADO_MATRIZ } from "./matrixConstants.js";
import { maybeStartTimer, computeTimerState } from "../session/timerService.js";
import { checkSessionAccess } from "../session/accessCheck.js";
import { createSessionManager } from "../session/sessionManager.js";
import { checkAndConsume } from "./rateLimiter.js";
import { CRISIS_META_v0 } from "./crisisBranchContent.js";
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
  conversationHistory: z.array(ConversationTurnSchema).max(40).default([]),
  emotionalState: EmotionalStateSchema,
  pendingTagIds: z.array(z.string()).default([]),
  modo: SimulationModeSchema.default("escenario"),
  // Optional non-personal grouping key from entry URL (?c=...). Only meaningful
  // on the very first turn — createSession stores it on the session doc.
  cohortCode: z.string().max(120).nullable().optional(),
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
  {
    region: "southamerica-west1",
    invoker: "public",
    timeoutSeconds: 180,
    memory: "512MiB",
    // Pinned via console on 2026-08-11 at 1; bumped to 3 on 2026-09-04 for GORE
    // event (75 concurrent). Safe to lower back to 1 once the event is over.
    minInstances: 3,
  },
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
      cohortCode,
    } = parsed.data;

    const sessionManager = createSessionManager();
    const turnStart = Date.now();

    // Phase 3 rate limit — deliberately BEFORE createSession so a hammered
    // container does no writes at all. Safety pipeline (below) is still the
    // first gate on anything user-visible or LLM-touching.
    const runtimeConfig = await loadRuntimeConfig();
    if (runtimeConfig.rateLimitEnabled) {
      const rate = checkAndConsume(userId, runtimeConfig.rpm);
      if (!rate.allowed) {
        return {
          reply: null,
          safe: true,
          safetyLayer: null,
          frameBreakSuspected: false,
          tagUpdates: 0,
          estadoMatriz: null,
          timerState: null,
          latenciaMs: null,
          rateLimited: true,
          retryAfterMs: rate.retryAfterMs,
        };
      }
    }

    await sessionManager.createSession({
      sessionId,
      userId,
      scenarioId,
      mode: "coach",
      promptVersion: COACH_PROMPT_VERSION,
      cohortCode: cohortCode ?? null,
    });

    // Owner + state gate. createSession is idempotent, so it may have returned
    // early on a pre-existing doc — the doc might belong to another user, be
    // closed, or be crisis_interrupted. In any of those cases we do NOT touch
    // nudgeState/lastUserActivityAt and we do NOT call Gemini.
    const sessionSnap = await db.collection("sessions").doc(sessionId).get();
    const sessionSlice = sessionSnap.exists
      ? (sessionSnap.data() as { userId?: string; state?: string } | undefined) ?? null
      : null;
    const access = checkSessionAccess(sessionSlice, userId);
    if (access.kind === "wrong-owner") {
      throw new HttpsError("permission-denied", "You do not own this session");
    }
    if (access.kind === "closed" || access.kind === "crisis-interrupted") {
      const closedState =
        access.kind === "closed" ? access.state : "crisis_interrupted";
      return {
        reply: null,
        safe: true,
        safetyLayer: null,
        frameBreakSuspected: false,
        tagUpdates: 0,
        estadoMatriz: null,
        timerState: null,
        latenciaMs: null,
        sessionClosed: true,
        closedState,
      };
    }

    // Phase 3 activity tracking — mark this user turn and reset the nudge
    // window. Idempotent; runs on every turn including crisis / rate-limited.
    // (We reach here only if rate limit passed AND the session is active, so
    // this always corresponds to a real trainee action.)
    await sessionManager.updateLastUserActivity(sessionId);

    // Safety pipeline runs FIRST (of anything user-visible) — before any LLM
    // or matrix calls.
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
      // Phase 4 (A7) — attach branch metadata when the pedagogical UX is enabled.
      // When the flag is off, `crisisMeta` is undefined and the client falls back
      // to the legacy single-button CrisisOverlay path.
      return {
        reply: crisisReply,
        safe: false,
        safetyLayer: safetyResult.layer,
        frameBreakSuspected: false,
        tagUpdates: 0,
        estadoMatriz: null,
        timerState: null,
        latenciaMs: null,
        ...(runtimeConfig.crisisBranchingEnabled ? { crisisMeta: CRISIS_META_v0 } : {}),
      };
    }

    // Start session timer on the first user turn (idempotent). The timer
    // counts up for display; no hard cutoff.
    const sesionIniciadaEn = await maybeStartTimer(sessionId);

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
      promptVersion: "coach_evaluator_v2",
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
    // Sampling gate (evaluatorEveryNTurns): under DSQ pressure the operator can
    // flip config/runtime.evaluatorEveryNTurns=2 to halve evaluator load.
    // Turn 0 always evaluates. Skipped turns add one more turn of matrix/tag
    // lag on top of the fire-and-forget lag already documented in debt-0017.
    const evaluatorEveryN = runtimeConfig.evaluatorEveryNTurns;
    const evaluatorShouldRun = turnNumber % evaluatorEveryN === 0;

    if (!evaluatorShouldRun) {
      console.log(`[COACH] Turn ${turnNumber} evaluator skipped (sampling 1/${evaluatorEveryN})`);
    } else {
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
    }

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
      // Vertex 429s here previously surfaced as "Ocurrió un error" at the exact
      // moment the system suspected distress. Per CLAUDE.md §6 asymmetry, fall
      // back to "D" (FRAME_BREAK template) on any failure — the template is
      // already worded safely for false positives.
      let l2Result: SafetyClassification;
      try {
        l2Result = await retryOnQuota(
          () => classifyMessage({
            message: traineeMessage,
            lastTurns: conversationHistory,
            mode: "coach",
          }),
          { maxAttempts: 2, label: "l2FrameBreak", timeoutMs: 15_000 },
        );
      } catch (err) {
        console.error("[SAFETY L2] frame-break classifier failed — conservative fallback to D", err);
        l2Result = "D";
      }

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
          timerState: computeTimerState(sesionIniciadaEn),
          latenciaMs,
          ...(runtimeConfig.crisisBranchingEnabled ? { crisisMeta: CRISIS_META_v0 } : {}),
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
      timerState: computeTimerState(sesionIniciadaEn),
      latenciaMs,
    };
  }
);

// timerOverride callable removed 2026-09-20: sessions no longer have a hard
// cutoff, so there is nothing to override. The `cronometroAnulado` field on
// the session doc is preserved (harmless) but never read.

// Explicit resume from a crisis_interrupted state. Called by the CrisisOverlay
// "Estoy listo/a para retomar" button. Owner-checked. Idempotent: if the
// session is already active it returns success without a write; if the session
// is in any other closed state, it does NOT reopen it (only crisis_interrupted
// is resumable via this path).
const ResumeAfterCrisisRequestSchema = z.object({
  sessionId: z.string(),
});

export const resumeAfterCrisis = onCall(
  { region: "southamerica-west1", invoker: "public" },
  async (request: CallableRequest) => {
    const userId = request.auth?.uid;
    if (userId === undefined) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const parsed = ResumeAfterCrisisRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid request data");
    }
    const { sessionId } = parsed.data;
    const sessionRef = db.collection("sessions").doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Session not found");
    }
    const data = snap.data() as { userId?: string; state?: string };
    if (data.userId !== userId) {
      throw new HttpsError("permission-denied", "You do not own this session");
    }
    if (data.state === "active") {
      return { success: true, alreadyActive: true, state: "active" };
    }
    if (data.state !== "crisis_interrupted") {
      // Any other terminal state (closed_inactivity, closed_completed) is not
      // resumable — the participant should start a new scenario.
      return { success: false, alreadyActive: false, state: data.state ?? null };
    }
    await sessionRef.update({
      state: "active",
      resumedAt: FieldValue.serverTimestamp(),
      // Fresh inactivity window from the moment the participant confirmed.
      nudgeState: "none",
      lastUserActivityAt: FieldValue.serverTimestamp(),
    });
    return { success: true, alreadyActive: false, state: "active" };
  }
);

// User-initiated session end. Marks the session state so analytics can tell
// user_ended sessions apart from ones the inactivity scheduler closed.
const EndSessionRequestSchema = z.object({
  sessionId: z.string(),
});

export const endSession = onCall(
  { region: "southamerica-west1", invoker: "public" },
  async (request: CallableRequest) => {
    const userId = request.auth?.uid;
    if (userId === undefined) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const parsed = EndSessionRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid request data");
    }
    const { sessionId } = parsed.data;

    const sessionRef = db.collection("sessions").doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Session not found");
    }
    const data = snap.data() as { userId?: string; state?: string };
    if (data.userId !== userId) {
      throw new HttpsError("permission-denied", "You do not own this session");
    }
    // Idempotent — if the session was already closed by inactivity or crisis,
    // leave that state in place.
    if (data.state !== "active") {
      return { success: true, alreadyClosed: true, state: data.state ?? null };
    }
    const sessionManager = createSessionManager();
    await sessionManager.completeSession(sessionId);
    return { success: true, alreadyClosed: false, state: "closed_completed" };
  }
);

// ── Phase 4 (A7) — crisis pedagogical branch ──────────────────────────────
// After the safety pipeline flags AND crisisBranchingEnabled is on, the client
// shows the user two branch buttons. The button click hits this callable.
//
// - `crisis_exercise`: user says "this was part of the training". We record the
//   branch, append a formative feedback message, and leave the session in the
//   crisis_interrupted state (already set by the coachTurn crisis path). The
//   client navigates to /report.
// - `crisis_flagged_real`: user says "this is really happening to me". We
//   record the branch. The client keeps the existing REAL_DISTRESS resources
//   template visible (already surfaced by the coachTurn crisis path). No
//   auto-resume — the session stays crisis_interrupted.
//
// NEVER edits packages/functions/src/safety/. Reads safety signals downstream
// via the session doc state; never re-runs detection.

import {
  CRISIS_BRANCH_PROMPT_TEXT,
  CRISIS_BRANCH_EXERCISE_FEEDBACK,
} from "./crisisBranchContent.js";
import { CrisisBranchIdSchema } from "@salvador/shared";

const CrisisBranchRequestSchema = z.object({
  sessionId: z.string(),
  branch: CrisisBranchIdSchema,
  // Reserved for a future free-text field on the overlay. Not surfaced today.
  freeText: z.string().max(500).optional(),
});

export const crisisBranch = onCall(
  { region: "southamerica-west1", invoker: "public" },
  async (request: CallableRequest) => {
    const userId = request.auth?.uid;
    if (userId === undefined) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const parsed = CrisisBranchRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid request data");
    }
    const { sessionId, branch } = parsed.data;

    // Confirm the caller owns the session before writing.
    const sessionRef = db.collection("sessions").doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Session not found");
    }
    const sessionData = snap.data() as { userId?: string; state?: string; turnCount?: number };
    if (sessionData.userId !== userId) {
      throw new HttpsError("permission-denied", "Not your session");
    }
    // Only meaningful after a crisis event. If the session isn't in the crisis
    // state, refuse rather than corrupt normal sessions.
    if (sessionData.state !== "crisis_interrupted") {
      throw new HttpsError(
        "failed-precondition",
        "Crisis branch only available in crisis_interrupted state",
      );
    }

    const sessionManager = createSessionManager();
    const nextTurnNumber = (sessionData.turnCount ?? 0) + 1;

    // Record the branch on the session doc. Persist even if the follow-up
    // append fails — the branch signal itself is durable and analytics-critical.
    await sessionRef.update({ crisisBranch: branch });

    // For crisis_exercise, append the formative feedback so it appears in the
    // /report render. For crisis_flagged_real, the resources template was
    // already appended by coachTurn — nothing to add here.
    if (branch === "crisis_exercise") {
      await sessionManager.appendMessage({
        sessionId,
        role: "assistant",
        content: CRISIS_BRANCH_EXERCISE_FEEDBACK,
        turnNumber: nextTurnNumber,
        promptVersion: COACH_PROMPT_VERSION,
      });
    }

    return {
      branch,
      promptText: CRISIS_BRANCH_PROMPT_TEXT,
      feedbackText: branch === "crisis_exercise" ? CRISIS_BRANCH_EXERCISE_FEEDBACK : null,
    };
  },
);
