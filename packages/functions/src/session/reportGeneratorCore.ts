// Pure core for the formative report generator. No Firebase imports — the
// vitest suite exercises the gates, prompt assembly, and verification
// without touching Firestore (debt-0021 safe).
//
// The impure layer (reportGenerator.ts) reads Firestore, calls Vertex, and
// persists. Everything decidable from local data lives here.

import {
  FormativeReportContentSchema,
  type FormativeReportContent,
  type FormativeReportMoment,
} from "@salvador/shared";
import type { EstadoMatriz, Scenario, TagDefinition } from "@salvador/shared";

// ── Input shapes (Firestore-agnostic subsets) ─────────────────────────────

export interface MessageSlice {
  role: "user" | "assistant" | "system";
  content: string;
  turnNumber: number;
  safetyLayerTriggered?: "L1" | "L2" | "L3" | null;
  meta?: { isNudge?: boolean } | null;
}

export interface TurnoSlice {
  turnoId: string;
  rol: "usuario" | "martina";
  contenido: string;
  deltas: {
    intensidadEmocional: number;
    apertura: number;
    confianzaEnLaAyuda: number | "RESET_ZERO";
  };
  tagsObservados: string[];
  antiPatronesDetectados: string[];
}

export interface SessionSlice {
  userId: string;
  state: string;
  endedReason: string | null;
  sesionIniciadaEnIso: string | null;
  endedAtIso: string | null;
  resumedAtIso: string | null;
  estadoMatriz: EstadoMatriz | null;
  /** attempts already recorded on formativeReport. Used by the impure caller. */
  currentAttempts: number;
  /** Existing report envelope, if any. */
  existingStatus: "generating" | "ready" | "failed" | "minimal" | null;
  existingGeneratedAtIso: string | null;
}

// ── Gates (pure — decide whether to generate) ─────────────────────────────

export type GateResult =
  | { kind: "already_ready" }
  | { kind: "generating_fresh" }                  // another generation < staleMs old
  | { kind: "generating_stale" }                  // can be reclaimed
  | { kind: "failed_can_retry" }
  | { kind: "failed_exhausted" }
  | { kind: "skip_crisis_interrupted" }
  | { kind: "skip_too_short"; userTurnCount: number }
  | { kind: "proceed"; userTurnCount: number };

export interface GateOptions {
  now: number;                  // epoch ms
  staleMs: number;              // e.g. 90_000
  maxAttempts: number;          // e.g. 2
  minUserTurns: number;         // 3 per user brief
}

export function gateSession(
  session: SessionSlice,
  messages: MessageSlice[],
  opts: GateOptions,
): GateResult {
  if (session.existingStatus === "ready") return { kind: "already_ready" };
  if (session.existingStatus === "generating") {
    const started = session.existingGeneratedAtIso === null
      ? 0
      : new Date(session.existingGeneratedAtIso).getTime();
    if (opts.now - started < opts.staleMs) return { kind: "generating_fresh" };
    return { kind: "generating_stale" };
  }
  if (session.existingStatus === "failed") {
    return session.currentAttempts >= opts.maxAttempts
      ? { kind: "failed_exhausted" }
      : { kind: "failed_can_retry" };
  }

  // No prior report. Check hard skip conditions.
  if (session.state === "crisis_interrupted") {
    return { kind: "skip_crisis_interrupted" };
  }
  const userTurnCount = messages.filter((m) => m.role === "user").length;
  if (userTurnCount < opts.minUserTurns) {
    return { kind: "skip_too_short", userTurnCount };
  }
  return { kind: "proceed", userTurnCount };
}

// ── Session facts (for [SESSION_FACTS] block) ─────────────────────────────

export interface SessionFacts {
  userTurnCount: number;
  durationMinutes: number | null;
  endedReason: string | null;
  wasResumedAfterCrisis: boolean;
}

export function computeSessionFacts(
  session: SessionSlice,
  messages: MessageSlice[],
): SessionFacts {
  const userTurnCount = messages.filter((m) => m.role === "user").length;
  let durationMinutes: number | null = null;
  if (session.sesionIniciadaEnIso !== null && session.endedAtIso !== null) {
    const start = new Date(session.sesionIniciadaEnIso).getTime();
    const end = new Date(session.endedAtIso).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      durationMinutes = Math.round((end - start) / 60_000);
    }
  }
  return {
    userTurnCount,
    durationMinutes,
    endedReason: session.endedReason,
    wasResumedAfterCrisis: session.resumedAtIso !== null,
  };
}

export function formatSessionFacts(f: SessionFacts): string {
  const parts = [
    `- Trainee turns: ${f.userTurnCount}`,
    `- Duration: ${f.durationMinutes === null ? "unknown" : `${f.durationMinutes} min`}`,
    `- Ended reason: ${f.endedReason ?? "unknown"}`,
    `- Session was resumed after a crisis pause: ${f.wasResumedAfterCrisis ? "yes" : "no"}`,
  ];
  return parts.join("\n");
}

// ── Conversation sanitization (crisis turn + template + nudges out) ──────

export interface SanitizedConversation {
  messages: MessageSlice[];
  excludedIndices: number[];
  excludedReasons: Record<number, "safety_trigger" | "safety_template" | "nudge">;
}

/**
 * Removes:
 *   - Any user message with safetyLayerTriggered set (L1/L2/L3).
 *   - The assistant message with the smallest turnNumber strictly greater than
 *     that user turn (the crisis template response is stored as a plain
 *     assistant message with no marker — this is the only reliable link).
 *   - Any message with meta.isNudge === true (inactivity nudges).
 *
 * If two safety triggers happened (unusual), each is paired with the next
 * unmatched assistant turn.
 */
export function sanitizeConversation(messages: MessageSlice[]): SanitizedConversation {
  const excluded = new Set<number>();
  const reasons: Record<number, "safety_trigger" | "safety_template" | "nudge"> = {};
  // Index by turnNumber for the paired-template lookup.
  const assistantByTurn = new Map<number, number>();
  messages.forEach((m, i) => {
    if (m.role === "assistant") assistantByTurn.set(m.turnNumber, i);
  });

  messages.forEach((m, i) => {
    if (m.meta?.isNudge === true) {
      excluded.add(i);
      reasons[i] = "nudge";
      return;
    }
    if (m.role === "user" && (m.safetyLayerTriggered ?? null) !== null) {
      excluded.add(i);
      reasons[i] = "safety_trigger";
      const pairedIdx = assistantByTurn.get(m.turnNumber + 1);
      if (pairedIdx !== undefined) {
        excluded.add(pairedIdx);
        reasons[pairedIdx] = "safety_template";
      }
    }
  });

  const sanitized = messages.filter((_, i) => !excluded.has(i));
  return {
    messages: sanitized,
    excludedIndices: Array.from(excluded).sort((a, b) => a - b),
    excludedReasons: reasons,
  };
}

// ── Prompt-block formatters ───────────────────────────────────────────────

export function formatConversationForPrompt(messages: MessageSlice[]): string {
  if (messages.length === 0) return "(no hay mensajes)";
  return messages
    .map((m) => {
      const speaker = m.role === "user" ? "Aprendiz" : "Martina";
      return `${speaker}: ${m.content}`;
    })
    .join("\n\n");
}

export function formatTurnEvaluations(turnos: TurnoSlice[]): string {
  if (turnos.length === 0) return "(no hay evaluaciones registradas)";
  const relevant = turnos.filter((t) => t.rol === "usuario");
  if (relevant.length === 0) return "(no hay evaluaciones registradas)";
  return relevant
    .map((t, i) => {
      const tags = t.tagsObservados.length > 0 ? t.tagsObservados.join(", ") : "(ninguno)";
      const antis = t.antiPatronesDetectados.length > 0 ? t.antiPatronesDetectados.join(", ") : "(ninguno)";
      return `Turno ${i + 1}: tagsObservados=[${tags}] antiPatronesDetectados=[${antis}]`;
    })
    .join("\n");
}

export function formatMatrixTrajectory(turnos: TurnoSlice[]): string {
  if (turnos.length === 0) return "(sin registro de matriz)";
  return turnos
    .map((t, i) => {
      const d = t.deltas;
      const c = d.confianzaEnLaAyuda === "RESET_ZERO" ? "RESET_ZERO" : String(d.confianzaEnLaAyuda);
      return `Turno ${i + 1} (${t.rol}): Δintensidad=${d.intensidadEmocional} Δapertura=${d.apertura} Δconfianza=${c}`;
    })
    .join("\n");
}

export function formatScenarioSummary(scenario: Scenario): string {
  return [
    `Personaje: ${scenario.persona.name}, ${scenario.persona.age} años. ${scenario.persona.role}.`,
    `Situación inicial: ${scenario.initialSituation}`,
    `Resultado esperado: ${scenario.expectedOutcome ?? "(sin definir)"}`,
  ].join("\n");
}

export function formatScenarioTags(tags: TagDefinition[]): string {
  if (tags.length === 0) return "(sin tags)";
  return tags
    .map((t) => {
      const musts = t.musts.map((m) => `    - ${m}`).join("\n");
      return `- ${t.tagId} (fase ${t.phase}): ${t.definition}\n  MUSTs:\n${musts}`;
    })
    .join("\n\n");
}

// ── Prompt assembly ───────────────────────────────────────────────────────

export interface PromptBlocks {
  scenarioSummary: string;
  scenarioTags: string;
  sessionFacts: string;
  turnEvaluations: string;
  matrixTrajectory: string;
  conversation: string;
}

export function assemblePrompt(template: string, blocks: PromptBlocks): string {
  return template
    .replace("[SCENARIO_SUMMARY]", blocks.scenarioSummary)
    .replace("[SCENARIO_TAGS]", blocks.scenarioTags)
    .replace("[SESSION_FACTS]", blocks.sessionFacts)
    .replace("[TURN_EVALUATIONS]", blocks.turnEvaluations)
    .replace("[MATRIX_TRAJECTORY]", blocks.matrixTrajectory)
    .replace("[CONVERSATION]", blocks.conversation);
}

// ── Quote verification ────────────────────────────────────────────────────

/**
 * Normalize for substring comparison: NFC compose, fold smart quotes to
 * straight, collapse whitespace, lowercase. Preserves accents (they are
 * meaningful to Spanish quotes) and preserves punctuation other than
 * fancy quotes / dashes.
 */
export function normalizeForQuoteMatch(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[“”„‟"«»]/g, '"')
    .replace(/[‘’‚‛']/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function verifyQuote(quote: string, corpusMessages: MessageSlice[]): boolean {
  const needle = normalizeForQuoteMatch(quote);
  if (needle.length === 0) return false;
  for (const m of corpusMessages) {
    if (normalizeForQuoteMatch(m.content).includes(needle)) return true;
  }
  return false;
}

export interface VerifiedMoment {
  moment: FormativeReportMoment;
  droppedMartinaCue: boolean;
}

export function verifyMoment(
  moment: FormativeReportMoment,
  userMessages: MessageSlice[],
  assistantMessages: MessageSlice[],
): VerifiedMoment | null {
  if (!verifyQuote(moment.quote, userMessages)) return null;

  let droppedMartinaCue = false;
  let finalMoment: FormativeReportMoment = moment;
  if (moment.martinaCue !== undefined) {
    if (!verifyQuote(moment.martinaCue, assistantMessages)) {
      // Only the cue is dropped — the moment itself survives.
      const { martinaCue: _drop, ...rest } = moment;
      finalMoment = rest;
      droppedMartinaCue = true;
    }
  }
  return { moment: finalMoment, droppedMartinaCue };
}

// ── Post-processing (verify moments, drop unverified) ─────────────────────

export interface PostProcessResult {
  ok: boolean;
  content: FormativeReportContent | null;
  droppedMoments: number;
  droppedMartinaCues: number;
  reason?: "moments_unverifiable" | "schema_invalid";
}

/**
 * Validates the raw model output against the Zod content schema, verifies
 * each moment's quotes, and drops moments that fail. Returns { ok: false }
 * when fewer than 2 moments survive — the caller can then retry once with
 * temperature: 0.
 */
export function postProcessReport(
  raw: unknown,
  messages: MessageSlice[],
): PostProcessResult {
  const parsed = FormativeReportContentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      content: null,
      droppedMoments: 0,
      droppedMartinaCues: 0,
      reason: "schema_invalid",
    };
  }
  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const survivors: FormativeReportMoment[] = [];
  let droppedCues = 0;
  for (const m of parsed.data.keyMoments) {
    const v = verifyMoment(m, userMessages, assistantMessages);
    if (v === null) continue;
    survivors.push(v.moment);
    if (v.droppedMartinaCue) droppedCues++;
  }
  const dropped = parsed.data.keyMoments.length - survivors.length;
  if (survivors.length < 2) {
    return {
      ok: false,
      content: null,
      droppedMoments: dropped,
      droppedMartinaCues: droppedCues,
      reason: "moments_unverifiable",
    };
  }
  return {
    ok: true,
    content: { ...parsed.data, keyMoments: survivors },
    droppedMoments: dropped,
    droppedMartinaCues: droppedCues,
  };
}

// ── JSON extraction (mirrors callB.ts::extractJsonObject) ─────────────────

export function extractJsonObject(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) return s.slice(first, last + 1);
  return s;
}

// ── Last-turn wait decision ───────────────────────────────────────────────

/**
 * Returns true only when exactly one user turn is missing an evaluator turno.
 * The impure caller uses this to decide whether to wait ≤ waitMs before
 * generation (Call B fire-and-forget can leave the last turn's turno
 * pending for a few seconds — debt-0017).
 */
export function shouldWaitForLastTurno(params: {
  userTurnCount: number;
  usuarioTurnoCount: number;
}): boolean {
  return params.userTurnCount - params.usuarioTurnoCount === 1;
}
