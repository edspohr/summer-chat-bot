import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import type {
  ConversationTurn,
  LabMode,
  LabScenario,
  LabMetrics,
  LabPromptSnapshot,
  EstadoMatriz,
  TimerState,
  SimulationMode,
  CrisisMeta,
  CrisisBranchId,
} from "@salvador/shared";

function getCallable<TReq, TRes>(name: string) {
  const functions = getFunctions(getApp(), "southamerica-west1");
  return httpsCallable<TReq, TRes>(functions, name);
}

interface MentorChatRequest {
  userMessage: string;
  sessionId: string;
  turnNumber: number;
  conversationHistory: ConversationTurn[];
}

interface MentorChatResponse {
  reply: string;
  safe: boolean;
  safetyLayer: string | null;
  ragChunksUsed: number;
}

export interface CoachTurnRequest {
  traineeMessage: string;
  sessionId: string;
  scenarioId: string;
  turnNumber: number;
  conversationHistory: ConversationTurn[];
  emotionalState: { emotionalIntensity: number; openness: number; trustInHelp: number };
  pendingTagIds: string[];
  modo?: SimulationMode;
  // Optional cohort/workshop code captured from the entry URL (?c=...).
  // Persisted to the session doc on first turn — non-personal grouping key.
  cohortCode?: string | null;
}

export interface CoachTurnResponse {
  reply: string | null;
  safe: boolean;
  safetyLayer: string | null;
  frameBreakSuspected: boolean;
  tagUpdates: number;
  estadoMatriz: EstadoMatriz | null;
  timerState: TimerState | null;
  timerExpired?: boolean;
  latenciaMs: { personaje: number; evaluador: number; total: number } | null;
  // Phase 3 — populated when the server-side token bucket rejected this turn.
  // Client should show a friendly toast and not append any assistant reply.
  rateLimited?: boolean;
  retryAfterMs?: number;
  // Phase 4 (A7) — present when safety flagged AND crisisBranchingEnabled is on.
  // Absent → CrisisOverlay uses the legacy single-button flow.
  crisisMeta?: CrisisMeta;
}

export interface CrisisBranchRequest {
  sessionId: string;
  branch: CrisisBranchId;
  freeText?: string;
}

export interface CrisisBranchResponse {
  branch: CrisisBranchId;
  promptText: string;
  feedbackText: string | null;
}

export interface TimerOverrideRequest {
  sessionId: string;
  anular: boolean;
}

export interface TimerOverrideResponse {
  success: boolean;
  cronometroAnulado: boolean;
}

export const callMentorChat = getCallable<MentorChatRequest, MentorChatResponse>("mentorChat");
export const callCoachTurn = getCallable<CoachTurnRequest, CoachTurnResponse>("coachTurn");
export const callTimerOverride = getCallable<TimerOverrideRequest, TimerOverrideResponse>("timerOverride");
export const callCrisisBranch = getCallable<CrisisBranchRequest, CrisisBranchResponse>("crisisBranch");

// ── Latency Lab (dev-only) ─────────────────────────────────────────────────

export interface LabChatRequest {
  message: string;
  mode: LabMode;
  scenario?: LabScenario;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  promptVersion?: string;
  sessionLabel?: string;
  sessionId?: string;
}

export interface LabChatResponse {
  content: string;
  metrics: LabMetrics;
  promptSnapshot: LabPromptSnapshot;
  sessionId: string;
  messageId: string;
  timestamp: string;
  estadoMatriz?: EstadoMatriz | null;
}

export const callLabChat = getCallable<LabChatRequest, LabChatResponse>("labChat");
