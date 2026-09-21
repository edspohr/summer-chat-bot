// Formative report orchestration. Reads session/messages/turnos, applies
// the pure gates, calls the model via reportGeneratorModel, and persists
// with a transaction on `sessions/{id}.formativeReport.status` to prevent
// double-generation from two tabs.
//
// Never throws to the client. Every code path resolves to a valid
// FormativeReport envelope. Never logs transcript, quotes, or report
// content — only sessionId + structural counters (see debt-0028).
//
// Replaces the pre-existing stub tracked in debt-0004.

import type {
  FormativeReport,
  FormativeReportSkipReason,
  Scenario,
  TagDefinition,
} from "@salvador/shared";
import {
  FormativeReportSchema,
  ScenarioSchema,
  TagDefinitionSchema,
} from "@salvador/shared";
import { db } from "../config/firebase.js";
import { loadPrompt } from "../prompts/loader.js";
import { loadRuntimeConfig } from "../config/runtimeConfig.js";
import { callFeedbackModel } from "./reportGeneratorModel.js";
import {
  assemblePrompt,
  computeSessionFacts,
  extractJsonObject,
  formatConversationForPrompt,
  formatMatrixTrajectory,
  formatScenarioSummary,
  formatScenarioTags,
  formatSessionFacts,
  formatTurnEvaluations,
  gateSession,
  postProcessReport,
  sanitizeConversation,
  shouldWaitForLastTurno,
  type MessageSlice,
  type SessionSlice,
  type TurnoSlice,
} from "./reportGeneratorCore.js";

const PROMPT_VERSION = "coach_feedback_v1";
const STALE_MS = 90_000;
const MAX_ATTEMPTS = 2;
const MIN_USER_TURNS = 3;
const LAST_TURNO_WAIT_MS = 4_000;

function nowIso(): string {
  return new Date().toISOString();
}

function log(sessionId: string, msg: string, meta: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.log(`[FEEDBACK] ${msg}`, { sessionId, ...meta });
}

// ── Firestore reads ──────────────────────────────────────────────────────

interface RawSession {
  userId?: string;
  state?: string;
  endedReason?: string | null;
  sesionIniciadaEn?: string | { toDate(): Date };
  endedAt?: { toDate(): Date };
  resumedAt?: { toDate(): Date };
  estadoMatriz?: unknown;
  scenarioId?: string;
  formativeReport?: FormativeReport;
  formativeReportAttempts?: number;
}

function tsToIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  const ts = v as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000).toISOString();
  return null;
}

async function loadSessionSlice(sessionId: string): Promise<{
  raw: RawSession;
  slice: SessionSlice;
} | null> {
  const snap = await db.collection("sessions").doc(sessionId).get();
  if (!snap.exists) return null;
  const raw = snap.data() as RawSession;
  const slice: SessionSlice = {
    userId: raw.userId ?? "",
    state: raw.state ?? "active",
    endedReason: raw.endedReason ?? null,
    sesionIniciadaEnIso: tsToIso(raw.sesionIniciadaEn),
    endedAtIso: tsToIso(raw.endedAt),
    resumedAtIso: tsToIso(raw.resumedAt),
    estadoMatriz: (raw.estadoMatriz as SessionSlice["estadoMatriz"]) ?? null,
    currentAttempts: raw.formativeReportAttempts ?? 0,
    existingStatus: raw.formativeReport?.status ?? null,
    existingGeneratedAtIso: raw.formativeReport?.generatedAtIso ?? null,
  };
  return { raw, slice };
}

async function loadMessages(sessionId: string): Promise<MessageSlice[]> {
  const snaps = await db
    .collection("sessions")
    .doc(sessionId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get();
  return snaps.docs.map((d) => {
    const data = d.data() as {
      role?: MessageSlice["role"];
      content?: string;
      turnNumber?: number;
      safetyLayerTriggered?: MessageSlice["safetyLayerTriggered"];
      meta?: MessageSlice["meta"];
    };
    return {
      role: data.role ?? "assistant",
      content: data.content ?? "",
      turnNumber: data.turnNumber ?? 0,
      safetyLayerTriggered: data.safetyLayerTriggered ?? null,
      meta: data.meta ?? null,
    };
  });
}

async function loadTurnos(sessionId: string): Promise<TurnoSlice[]> {
  const snaps = await db
    .collection("sessions")
    .doc(sessionId)
    .collection("turnos")
    .orderBy("creadoEn", "asc")
    .get();
  const out: TurnoSlice[] = [];
  for (const d of snaps.docs) {
    const data = d.data() as {
      rol?: TurnoSlice["rol"];
      contenido?: string;
      deltas?: {
        intensidadEmocional?: number;
        apertura?: number;
        confianzaEnLaAyuda?: number | "RESET_ZERO";
      };
      tagsObservados?: string[];
      antiPatronesDetectados?: string[];
    };
    if (data.rol === undefined) continue;
    out.push({
      turnoId: d.id,
      rol: data.rol,
      contenido: data.contenido ?? "",
      deltas: {
        intensidadEmocional: data.deltas?.intensidadEmocional ?? 0,
        apertura: data.deltas?.apertura ?? 0,
        confianzaEnLaAyuda: data.deltas?.confianzaEnLaAyuda ?? 0,
      },
      tagsObservados: data.tagsObservados ?? [],
      antiPatronesDetectados: data.antiPatronesDetectados ?? [],
    });
  }
  return out;
}

async function loadScenarioAndTags(scenarioId: string): Promise<{
  scenario: Scenario;
  tags: TagDefinition[];
} | null> {
  const scenarioSnap = await db.collection("scenarios").doc(scenarioId).get();
  if (!scenarioSnap.exists) return null;
  const scenarioParsed = ScenarioSchema.safeParse({ id: scenarioSnap.id, ...scenarioSnap.data() });
  if (!scenarioParsed.success) return null;
  const tagIds = scenarioParsed.data.requiredTags.map((t) => t.tagId);
  const tagSnaps = await Promise.all(
    tagIds.map((id) => db.collection("tag_definitions").doc(id).get()),
  );
  const tags: TagDefinition[] = [];
  for (const snap of tagSnaps) {
    if (!snap.exists) continue;
    const parsed = TagDefinitionSchema.safeParse({ tagId: snap.id, ...snap.data() });
    if (parsed.success) tags.push(parsed.data);
  }
  return { scenario: scenarioParsed.data, tags };
}

async function persistReport(sessionId: string, report: FormativeReport): Promise<void> {
  await db
    .collection("sessions")
    .doc(sessionId)
    .set(
      {
        formativeReport: report,
        reportGenerated: report.status === "ready",
      },
      { merge: true },
    );
}

/**
 * Transaction: on `proceed` / `failed_can_retry` / `generating_stale` set
 * status to `generating` with a fresh timestamp + bumped attempts. Returns
 * either a fresh claim or the existing report to return unchanged.
 */
async function claimGenerationSlot(sessionId: string): Promise<
  | { claimed: true; generatedAtIso: string }
  | { claimed: false; report: FormativeReport }
> {
  const ref = db.collection("sessions").doc(sessionId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("session_not_found");
    const raw = snap.data() as RawSession;
    const existing = raw.formativeReport;
    if (existing?.status === "ready") return { claimed: false, report: existing };
    if (existing?.status === "generating") {
      const started = new Date(existing.generatedAtIso).getTime();
      if (Date.now() - started < STALE_MS) return { claimed: false, report: existing };
    }
    if (existing?.status === "failed") {
      const attempts = raw.formativeReportAttempts ?? 0;
      if (attempts >= MAX_ATTEMPTS) return { claimed: false, report: existing };
    }
    const generatingReport: FormativeReport = {
      status: "generating",
      promptVersion: PROMPT_VERSION,
      generatedAtIso: nowIso(),
      wasResumedAfterCrisis: raw.resumedAt !== undefined,
    };
    const attempts = (raw.formativeReportAttempts ?? 0) + 1;
    tx.set(
      ref,
      { formativeReport: generatingReport, formativeReportAttempts: attempts },
      { merge: true },
    );
    return { claimed: true, generatedAtIso: generatingReport.generatedAtIso };
  });
}

async function waitForLastTurnoIfNeeded(
  sessionId: string,
  userTurnCount: number,
): Promise<TurnoSlice[]> {
  let turnos = await loadTurnos(sessionId);
  const usuarioTurnos = turnos.filter((t) => t.rol === "usuario").length;
  if (!shouldWaitForLastTurno({ userTurnCount, usuarioTurnoCount: usuarioTurnos })) {
    return turnos;
  }
  const deadline = Date.now() + LAST_TURNO_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    turnos = await loadTurnos(sessionId);
    const now = turnos.filter((t) => t.rol === "usuario").length;
    if (now >= userTurnCount) return turnos;
  }
  log(sessionId, "last_turno_missing_after_wait", {
    userTurnCount,
    usuarioTurnos: turnos.filter((t) => t.rol === "usuario").length,
  });
  return turnos;
}

async function buildPrompt(params: {
  session: SessionSlice;
  messages: MessageSlice[];
  sanitizedMessages: MessageSlice[];
  turnos: TurnoSlice[];
  scenario: Scenario;
  tags: TagDefinition[];
}): Promise<string> {
  const template = await loadPrompt(PROMPT_VERSION);
  const facts = computeSessionFacts(params.session, params.messages);
  return assemblePrompt(template, {
    scenarioSummary: formatScenarioSummary(params.scenario),
    scenarioTags: formatScenarioTags(params.tags),
    sessionFacts: formatSessionFacts(facts),
    turnEvaluations: formatTurnEvaluations(params.turnos),
    matrixTrajectory: formatMatrixTrajectory(params.turnos),
    conversation: formatConversationForPrompt(params.sanitizedMessages),
  });
}

// ── Public entry point ───────────────────────────────────────────────────

export interface GenerateResult {
  report: FormativeReport;
  /** True when this call did the work; false if it observed a fresh result. */
  didWork: boolean;
}

/**
 * Idempotent. Safe to call from ClosingScreen (prefetch) and /report
 * (blocking). Never throws — every code path returns a valid envelope.
 * Owner check must be performed by the caller (the callable does it).
 */
export async function generateFormativeReportForSession(
  sessionId: string,
): Promise<GenerateResult> {
  const loaded = await loadSessionSlice(sessionId);
  if (loaded === null) {
    const report = minimalReport("generation_failed", "session_not_found");
    log(sessionId, "session_not_found");
    return { didWork: false, report };
  }
  const messages = await loadMessages(sessionId);
  const decision = gateSession(loaded.slice, messages, {
    now: Date.now(),
    staleMs: STALE_MS,
    maxAttempts: MAX_ATTEMPTS,
    minUserTurns: MIN_USER_TURNS,
  });

  if (
    decision.kind === "already_ready" ||
    decision.kind === "generating_fresh" ||
    decision.kind === "failed_exhausted"
  ) {
    const existing = loaded.raw.formativeReport;
    if (existing !== undefined) return { didWork: false, report: existing };
  }
  if (decision.kind === "skip_crisis_interrupted") {
    const report: FormativeReport = {
      ...minimalReport("crisis_interrupted"),
      wasResumedAfterCrisis: false,
    };
    await persistReport(sessionId, report);
    log(sessionId, "skip_crisis_interrupted");
    return { didWork: true, report };
  }
  if (decision.kind === "skip_too_short") {
    const report: FormativeReport = {
      ...minimalReport("too_short"),
      wasResumedAfterCrisis: loaded.raw.resumedAt !== undefined,
    };
    await persistReport(sessionId, report);
    log(sessionId, "skip_too_short", { userTurnCount: decision.userTurnCount });
    return { didWork: true, report };
  }

  // Claim (proceed / failed_can_retry / generating_stale). Any other
  // kind was handled above.
  const claim = await claimGenerationSlot(sessionId);
  if (!claim.claimed) return { didWork: false, report: claim.report };

  const wasResumedAfterCrisis = loaded.raw.resumedAt !== undefined;
  const scenarioId = loaded.raw.scenarioId ?? "";
  const scenarioBundle = await loadScenarioAndTags(scenarioId);
  if (scenarioBundle === null) {
    const report: FormativeReport = {
      ...minimalReport("generation_failed", "scenario_missing"),
      wasResumedAfterCrisis,
    };
    await persistReport(sessionId, report);
    log(sessionId, "scenario_missing", { scenarioId });
    return { didWork: true, report };
  }

  const runtimeConfig = await loadRuntimeConfig();
  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const turnos = await waitForLastTurnoIfNeeded(sessionId, userTurnCount);
  const sanitized = sanitizeConversation(messages);

  const prompt = await buildPrompt({
    session: loaded.slice,
    messages,
    sanitizedMessages: sanitized.messages,
    turnos,
    scenario: scenarioBundle.scenario,
    tags: scenarioBundle.tags,
  });

  try {
    const modelResult = await callFeedbackModel({
      prompt,
      model: runtimeConfig.feedbackModel,
      maxOutputTokens: runtimeConfig.feedbackMaxOutputTokens,
      thinkingBudget: runtimeConfig.feedbackThinkingBudget,
      timeoutMs: runtimeConfig.feedbackTimeoutMs,
    });
    log(sessionId, "model_call_1", {
      finishReason: modelResult.finishReason,
      latencyMs: modelResult.latencyMs,
      candidateTokens: modelResult.candidateTokens,
      thoughtsTokens: modelResult.thoughtsTokens,
      excludedMessages: sanitized.excludedIndices.length,
      wasResumedAfterCrisis,
    });

    // Retry once with thinkingBudget=0 if truncated.
    let effectiveResult = modelResult;
    if (
      modelResult.finishReason?.toUpperCase() === "MAX_TOKENS" &&
      runtimeConfig.feedbackThinkingBudget > 0
    ) {
      const retry = await callFeedbackModel({
        prompt,
        model: runtimeConfig.feedbackModel,
        maxOutputTokens: runtimeConfig.feedbackMaxOutputTokens,
        thinkingBudget: 0,
        timeoutMs: runtimeConfig.feedbackTimeoutMs,
      });
      log(sessionId, "retry_thinking0", {
        finishReason: retry.finishReason,
        latencyMs: retry.latencyMs,
      });
      effectiveResult = retry;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonObject(effectiveResult.rawJson));
    } catch (err) {
      const report: FormativeReport = {
        ...minimalReport("generation_failed", `parse: ${(err as Error).message.slice(0, 100)}`),
        wasResumedAfterCrisis,
      };
      await persistReport(sessionId, report);
      log(sessionId, "parse_failed", {
        finishReason: effectiveResult.finishReason,
        rawLen: effectiveResult.rawJson.length,
      });
      return { didWork: true, report };
    }

    let post = postProcessReport(parsed, messages);
    if (!post.ok && post.reason === "moments_unverifiable") {
      const retry = await callFeedbackModel({
        prompt,
        model: runtimeConfig.feedbackModel,
        maxOutputTokens: runtimeConfig.feedbackMaxOutputTokens,
        thinkingBudget: runtimeConfig.feedbackThinkingBudget,
        timeoutMs: runtimeConfig.feedbackTimeoutMs,
        temperature: 0,
      });
      log(sessionId, "retry_temp0", { finishReason: retry.finishReason });
      try {
        const parsed2 = JSON.parse(extractJsonObject(retry.rawJson));
        const post2 = postProcessReport(parsed2, messages);
        if (post2.ok) {
          post = post2;
          effectiveResult = retry;
        }
      } catch {
        // Fall through to minimal.
      }
    }

    if (!post.ok) {
      const skipReason: FormativeReportSkipReason =
        post.reason === "moments_unverifiable" ? "moments_unverifiable" : "generation_failed";
      const report: FormativeReport = {
        ...minimalReport(skipReason, `dropped=${post.droppedMoments}`),
        wasResumedAfterCrisis,
      };
      await persistReport(sessionId, report);
      log(sessionId, "postprocess_failed", {
        reason: post.reason,
        droppedMoments: post.droppedMoments,
        droppedMartinaCues: post.droppedMartinaCues,
      });
      return { didWork: true, report };
    }

    const finalReport: FormativeReport = {
      status: "ready",
      promptVersion: PROMPT_VERSION,
      generatedAtIso: nowIso(),
      modelUsed: effectiveResult.modelUsed,
      content: post.content ?? undefined,
      wasResumedAfterCrisis,
    };
    const validated = FormativeReportSchema.safeParse(finalReport);
    if (!validated.success) {
      const report: FormativeReport = {
        ...minimalReport("generation_failed", "schema_invalid_envelope"),
        wasResumedAfterCrisis,
      };
      await persistReport(sessionId, report);
      log(sessionId, "envelope_invalid");
      return { didWork: true, report };
    }
    await persistReport(sessionId, validated.data);
    log(sessionId, "ready", {
      keyMoments: post.content!.keyMoments.length,
      droppedMoments: post.droppedMoments,
      droppedMartinaCues: post.droppedMartinaCues,
    });
    return { didWork: true, report: validated.data };
  } catch (err) {
    const report: FormativeReport = {
      ...minimalReport("generation_failed", (err as Error).message.slice(0, 200)),
      wasResumedAfterCrisis,
    };
    await persistReport(sessionId, report);
    log(sessionId, "exception", { err: (err as Error).message });
    return { didWork: true, report };
  }
}

function minimalReport(reason: FormativeReportSkipReason, detail?: string): FormativeReport {
  const base: FormativeReport = {
    status: reason === "generation_failed" ? "failed" : "minimal",
    promptVersion: PROMPT_VERSION,
    generatedAtIso: nowIso(),
    skipReason: reason,
    wasResumedAfterCrisis: false,
    ...(detail !== undefined ? { failureDetail: detail } : {}),
  };
  return FormativeReportSchema.parse(base);
}
