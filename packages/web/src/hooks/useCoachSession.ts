import { useState, useCallback, useRef, useEffect } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import type {
  ConversationTurn,
  Scenario,
  EstadoMatriz,
  TimerState,
  SimulationMode,
  CrisisMeta,
  CrisisBranchId,
} from "@salvador/shared";
import { INITIAL_MATRIX } from "@salvador/shared";
import { callCoachTurn, callCrisisBranch } from "../lib/functions.js";
import { db } from "../firebase.js";

interface LocalMessage {
  role: "user" | "assistant";
  content: string;
}

interface EmotionalState {
  emotionalIntensity: number;
  openness: number;
  trustInHelp: number;
}

export interface RateLimitInfo {
  retryAfterMs: number;
  at: number; // Date.now() when the limit was hit — used by consumers to auto-dismiss.
}

export interface CrisisBranchOutcome {
  branch: CrisisBranchId;
  feedbackText: string | null;
}

export function useCoachSession(
  sessionId: string,
  scenario: Scenario,
  completedTagIds: string[],
  modo: SimulationMode = "escenario",
  cohortCode: string | null = null,
): {
  messages: LocalMessage[];
  send: (content: string) => Promise<void>;
  isLoading: boolean;
  crisisTemplate: string | null;
  clearCrisis: () => void;
  estadoMatriz: EstadoMatriz | null;
  timerState: TimerState | null;
  timerExpired: boolean;
  latenciaMs: { personaje: number; evaluador: number; total: number } | null;
  rateLimit: RateLimitInfo | null;
  clearRateLimit: () => void;
  crisisMeta: CrisisMeta | null;
  crisisBranchOutcome: CrisisBranchOutcome | null;
  chooseCrisisBranch: (branch: CrisisBranchId) => Promise<void>;
} {
  const allTagIds = scenario.requiredTags.map((t) => t.tagId);

  const initialEmotionalState: EmotionalState = {
    emotionalIntensity: scenario.emotionalStateVariables.emotionalIntensity.initial,
    openness: scenario.emotionalStateVariables.openness.initial,
    trustInHelp: scenario.emotionalStateVariables.trustInHelp.initial,
  };

  const seedMessage: LocalMessage = { role: "assistant", content: scenario.seedMessage };

  const [messages, setMessages] = useState<LocalMessage[]>([seedMessage]);
  const [history, setHistory] = useState<ConversationTurn[]>([
    { role: "assistant", content: scenario.seedMessage, turnNumber: 0 },
  ]);
  const [turnNumber, setTurnNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [crisisTemplate, setCrisisTemplate] = useState<string | null>(null);

  // Server-authoritative matrix and timer state
  const [estadoMatriz, setEstadoMatriz] = useState<EstadoMatriz | null>(
    modo === "escenario"
      ? { ...INITIAL_MATRIX, pisoIntensidadActivo: true, derivacionAcordada: false }
      : null,
  );
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);
  const [latenciaMs, setLatenciaMs] = useState<{ personaje: number; evaluador: number; total: number } | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [crisisMeta, setCrisisMeta] = useState<CrisisMeta | null>(null);
  const [crisisBranchOutcome, setCrisisBranchOutcome] = useState<CrisisBranchOutcome | null>(null);

  // Refs for values that change frequently — avoids stale closures in send callback
  const completedTagIdsRef = useRef(completedTagIds);
  completedTagIdsRef.current = completedTagIds;

  const historyRef = useRef(history);
  historyRef.current = history;

  const turnNumberRef = useRef(turnNumber);
  turnNumberRef.current = turnNumber;

  // Realtime listener for out-of-band assistant messages — currently only the
  // Phase 3 inactivity nudge ("¿Profe, sigue ahí?") is written server-side
  // outside the coachTurn response. Filters isNudge=true client-side to avoid
  // needing a single-field index on nested meta.isNudge.
  const surfacedNudgeIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const q = collection(db, "sessions", sessionId, "messages");
    const unsub = onSnapshot(q, (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type !== "added") continue;
        if (surfacedNudgeIdsRef.current.has(change.doc.id)) continue;
        const data = change.doc.data() as {
          role?: string;
          content?: string;
          meta?: { isNudge?: boolean };
        };
        if (data.meta?.isNudge !== true) continue;
        if (data.role !== "assistant" || typeof data.content !== "string") continue;
        surfacedNudgeIdsRef.current.add(change.doc.id);
        setMessages((prev) => [...prev, { role: "assistant", content: data.content ?? "" }]);
      }
    });
    return unsub;
  }, [sessionId]);

  // Realtime listener for session-level state transitions. When the inactivity
  // scheduler closes the session (state='closed_inactivity'), signal expiry so
  // the trainee UI navigates to the report — same path as timer-based expiry.
  // We only watch closed_inactivity here; closed_completed already flows via
  // the coachTurn response (timerExpired flag).
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sessions", sessionId), (snap) => {
      const data = snap.data();
      if (data === undefined) return;
      const state = (data as { state?: string }).state;
      if (state === "closed_inactivity") {
        setTimerExpired(true);
      }
    });
    return unsub;
  }, [sessionId]);

  const send = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const currentHistory = historyRef.current;
    const currentTurnNumber = turnNumberRef.current;
    const currentPendingTagIds = allTagIds.filter(
      (id) => !completedTagIdsRef.current.includes(id)
    );

    const userMsg: LocalMessage = { role: "user", content };
    const userTurn: ConversationTurn = { role: "user", content, turnNumber: currentTurnNumber };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const result = await callCoachTurn({
        traineeMessage: content,
        sessionId,
        scenarioId: scenario.id,
        turnNumber: currentTurnNumber,
        conversationHistory: currentHistory,
        emotionalState: initialEmotionalState,
        pendingTagIds: currentPendingTagIds,
        modo,
        cohortCode,
      });

      const data = result.data;

      // Rate limited — rollback the optimistic user message and surface a
      // toast. Do NOT advance turnNumber or history. The token bucket refills
      // in retryAfterMs; the user can just retry after that.
      if (data.rateLimited === true) {
        setMessages((prev) => prev.filter((m) => m !== userMsg));
        setRateLimit({
          retryAfterMs: typeof data.retryAfterMs === "number" ? data.retryAfterMs : 5000,
          at: Date.now(),
        });
        setIsLoading(false);
        return;
      }

      // Update server-authoritative state
      if (data.estadoMatriz !== null) setEstadoMatriz(data.estadoMatriz);
      if (data.timerState !== null) setTimerState(data.timerState);
      if (data.latenciaMs !== null) setLatenciaMs(data.latenciaMs);

      // Timer expired — don't append reply, just flag it
      if (data.timerExpired === true) {
        setTimerExpired(true);
        setIsLoading(false);
        return;
      }

      if (data.reply === null) {
        setIsLoading(false);
        return;
      }

      const assistantMsg: LocalMessage = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, assistantMsg]);

      if (!data.safe) {
        setCrisisTemplate(data.reply);
        // Phase 4 (A7) — when the server ships crisisMeta, the overlay renders
        // the branch UX. Absent → legacy single-button overlay.
        if (data.crisisMeta !== undefined) setCrisisMeta(data.crisisMeta);
        setHistory((prev) => [...prev, userTurn]);
        setTurnNumber((n) => n + 1);
      } else {
        const assistantTurn: ConversationTurn = {
          role: "assistant",
          content: data.reply,
          turnNumber: currentTurnNumber + 1,
        };
        setHistory((prev) => [...prev, userTurn, assistantTurn]);
        setTurnNumber((n) => n + 2);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ocurrió un error. Por favor intenta de nuevo." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, scenario.id, modo]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearCrisis = useCallback(() => {
    setCrisisTemplate(null);
    setCrisisMeta(null);
    setCrisisBranchOutcome(null);
  }, []);
  const clearRateLimit = useCallback(() => setRateLimit(null), []);

  const chooseCrisisBranch = useCallback(async (branch: CrisisBranchId) => {
    try {
      const result = await callCrisisBranch({ sessionId, branch });
      const data = result.data;
      setCrisisBranchOutcome({ branch: data.branch, feedbackText: data.feedbackText });
    } catch (err) {
      console.error("[CRISIS_BRANCH] Failed to record branch", err);
      // Fall through: leave overlay in the prompt state so the user can retry.
    }
  }, [sessionId]);

  return {
    messages,
    send,
    isLoading,
    crisisTemplate,
    clearCrisis,
    estadoMatriz,
    timerState,
    timerExpired,
    latenciaMs,
    rateLimit,
    clearRateLimit,
    crisisMeta,
    crisisBranchOutcome,
    chooseCrisisBranch,
  };
}
