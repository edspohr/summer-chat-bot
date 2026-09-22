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
  latenciaMs: { personaje: number; evaluador: number; total: number } | null;
  // Server refused to process the turn because the session is no longer in
  // an active state. Client should transition to the closing screen (for
  // closed_*) or ensure the crisis overlay is showing (for crisis_interrupted).
  sessionClosed?: boolean;
  closedState?: "closed_inactivity" | "closed_completed" | "crisis_interrupted";
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

export interface EndSessionRequest {
  sessionId: string;
}
export interface EndSessionResponse {
  success: boolean;
  alreadyClosed: boolean;
  state: string | null;
}

export interface ResumeAfterCrisisRequest {
  sessionId: string;
}
export interface ResumeAfterCrisisResponse {
  success: boolean;
  alreadyActive: boolean;
  state: string | null;
}

// Fase 4 — formative report.
export interface GenerateSessionReportRequest {
  sessionId: string;
}
export interface GenerateSessionReportResponse {
  report: import("@salvador/shared").FormativeReport;
  didWork: boolean;
}

// Fase 4 — trainee self-reflection with Layer 3 gate.
export interface SaveReflectionRequest {
  sessionId: string;
  text: string;
}
export interface SaveReflectionResponse {
  saved: boolean;
  safetyMatch: import("@salvador/shared").ReflectionSafetyMatch | null;
}

export const callMentorChat = getCallable<MentorChatRequest, MentorChatResponse>("mentorChat");
export const callCoachTurn = getCallable<CoachTurnRequest, CoachTurnResponse>("coachTurn");
export const callCrisisBranch = getCallable<CrisisBranchRequest, CrisisBranchResponse>("crisisBranch");
export const callEndSession = getCallable<EndSessionRequest, EndSessionResponse>("endSession");
export const callResumeAfterCrisis =
  getCallable<ResumeAfterCrisisRequest, ResumeAfterCrisisResponse>("resumeAfterCrisis");
export const callGenerateSessionReport =
  getCallable<GenerateSessionReportRequest, GenerateSessionReportResponse>("generateSessionReport");
export const callSaveReflection =
  getCallable<SaveReflectionRequest, SaveReflectionResponse>("saveReflection");

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
