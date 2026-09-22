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
import { MARTINA_INITIAL_MATRIX, initialMatrixFor } from "@salvador/shared";
import { callCoachTurn, callCrisisBranch, callResumeAfterCrisis } from "../lib/functions.js";
import { db } from "../firebase.js";

interface LocalMessage {
  role: "user" | "assistant";
  content: string;
}

// Minimum "typing" window for Martina's replies. If the server responds
// faster than this, we hold the reply until the window elapses; if it
// responds slower, the reply is shown as soon as it arrives. Softens the
// tempo — instant replies broke immersion.
const MIN_TYPING_MS_BASE = 4000;
const MIN_TYPING_MS_JITTER = 2000;

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
  send: (content: string) => Promise<boolean>;
  isLoading: boolean;
  crisisTemplate: string | null;
  clearCrisis: () => void;
  /** Confirms the crisis pause with the server; only then does the overlay
   *  clear locally. If the server call fails the local state is untouched so
   *  the trainee can retry. */
  resumeCrisis: () => Promise<boolean>;
  estadoMatriz: EstadoMatriz | null;
  timerState: TimerState | null;
  /** Latest terminal server state: 'closed_inactivity', 'closed_completed'
   *  or 'crisis_interrupted'. Sourced from the Firestore listener and from
   *  coachTurn's sessionClosed response. `null` while the session is active. */
  serverClosedState:
    | "closed_inactivity"
    | "closed_completed"
    | "crisis_interrupted"
    | null;
  latenciaMs: { personaje: number; evaluador: number; total: number } | null;
  rateLimit: RateLimitInfo | null;
  clearRateLimit: () => void;
  crisisMeta: CrisisMeta | null;
  crisisBranchOutcome: CrisisBranchOutcome | null;
  chooseCrisisBranch: (branch: CrisisBranchId) => Promise<void>;
} {
  const allTagIds = scenario.requiredTags.map((t) => t.tagId);

  // Initial emotional-state values used for the Call A prompt scaffold and
  // the client's optimistic matrix bars. Sourced from the same canonical
  // map the engine falls back to — never from scenario.emotionalStateVariables
  // (decorative; see docs/debt/0022).
  const canonicalInitial = initialMatrixFor(scenario.id) ?? MARTINA_INITIAL_MATRIX;
  const initialEmotionalState: EmotionalState = {
    emotionalIntensity: canonicalInitial.intensidadEmocional,
    openness: canonicalInitial.apertura,
    trustInHelp: canonicalInitial.confianzaEnLaAyuda,
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
    modo === "escenario" ? canonicalInitial : null,
  );
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [serverClosedState, setServerClosedState] = useState<
    "closed_inactivity" | "closed_completed" | "crisis_interrupted" | null
  >(null);
  const [latenciaMs, setLatenciaMs] = useState<{ personaje: number; evaluador: number; total: number } | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [crisisMeta, setCrisisMeta] = useState<CrisisMeta | null>(null);
  const [crisisBranchOutcome, setCrisisBranchOutcome] = useState<CrisisBranchOutcome | null>(null);

  // Session doc is created by coachTurn on the first user turn — before that,
  // any onSnapshot on sessions/{id} or its subcollections fails permission-denied
  // (rules check resource.data.userId on a non-existent doc). Flip this true
  // after the first successful callable response so the listeners subscribe only
  // once the doc exists.
  const [sessionCreated, setSessionCreated] = useState(false);

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
    if (!sessionCreated) return;
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
  }, [sessionId, sessionCreated]);

  // Realtime listener for session-level state transitions. Watches
  // closed_inactivity + closed_completed (both drive the closing screen) and
  // crisis_interrupted (kept for the resume flow — the overlay itself is
  // toggled by crisisTemplate). No auto-navigate: any transition to a
  // terminal state requires an explicit click to reach the report.
  useEffect(() => {
    if (!sessionCreated) return;
    const unsub = onSnapshot(doc(db, "sessions", sessionId), (snap) => {
      const data = snap.data();
      if (data === undefined) return;
      const state = (data as { state?: string }).state;
      if (
        state === "closed_inactivity" ||
        state === "closed_completed" ||
        state === "crisis_interrupted"
      ) {
        setServerClosedState(state);
      } else if (state === "active") {
        // Resumed from crisis — drop the terminal marker.
        setServerClosedState(null);
      }
    });
    return unsub;
  }, [sessionId, sessionCreated]);

  const send = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim()) return false;

    // Cap history to match the server-side schema max in coachHandler.ts
    // (currently 40). We keep the last 20 client-side: recent context
    // matters most for LLM coherence, and the seed is dropped after a few
    // exchanges (Martina's persona is re-primed via the scenario doc in
    // every Call A prompt).
    const currentHistory = historyRef.current.slice(-20);
    const currentTurnNumber = turnNumberRef.current;
    const currentPendingTagIds = allTagIds.filter(
      (id) => !completedTagIdsRef.current.includes(id)
    );

    const userMsg: LocalMessage = { role: "user", content };
    const userTurn: ConversationTurn = { role: "user", content, turnNumber: currentTurnNumber };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const sendStart = Date.now();
    const minTypingMs = MIN_TYPING_MS_BASE + Math.random() * MIN_TYPING_MS_JITTER;

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
      // NB: rate-limit is checked in coachHandler BEFORE session creation, so
      // this branch must run before flipping sessionCreated — otherwise
      // listeners attach to a nonexistent doc and detach with permission-denied.
      if (data.rateLimited === true) {
        setMessages((prev) => prev.filter((m) => m !== userMsg));
        setRateLimit({
          retryAfterMs: typeof data.retryAfterMs === "number" ? data.retryAfterMs : 5000,
          at: Date.now(),
        });
        setIsLoading(false);
        return false;
      }

      // First successful callable response guarantees the session doc exists.
      // Unblocks the two onSnapshot listeners guarded by sessionCreated above.
      if (!sessionCreated) setSessionCreated(true);

      // Update server-authoritative state
      if (data.estadoMatriz !== null) setEstadoMatriz(data.estadoMatriz);
      if (data.timerState !== null) setTimerState(data.timerState);
      if (data.latenciaMs !== null) setLatenciaMs(data.latenciaMs);

      // Server refused to process because the session is no longer active.
      // Roll back the optimistic user message so it doesn't dangle above the
      // closing screen, and mark the terminal state.
      if (data.sessionClosed === true) {
        setMessages((prev) => prev.filter((m) => m !== userMsg));
        if (data.closedState !== undefined) setServerClosedState(data.closedState);
        setIsLoading(false);
        return false;
      }

      if (data.reply === null) {
        setIsLoading(false);
        return true;
      }

      const elapsed = Date.now() - sendStart;
      const holdMs = Math.max(0, minTypingMs - elapsed);
      if (holdMs > 0) await new Promise((r) => setTimeout(r, holdMs));

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
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("[COACH_TURN] send failed", err);
      setMessages((prev) => [
        ...prev.filter((m) => m !== userMsg),
        { role: "assistant", content: "Ocurrió un error. Por favor intenta de nuevo." },
      ]);
      setIsLoading(false);
      return false;
    }
  }, [sessionId, scenario.id, modo]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearCrisis = useCallback(() => {
    setCrisisTemplate(null);
    setCrisisMeta(null);
    setCrisisBranchOutcome(null);
  }, []);

  const resumeCrisis = useCallback(async (): Promise<boolean> => {
    try {
      const result = await callResumeAfterCrisis({ sessionId });
      if (result.data.success !== true) {
        console.warn(
          "[RESUME_CRISIS] Server refused resume — session state is",
          result.data.state
        );
        return false;
      }
    } catch (err) {
      console.error("[RESUME_CRISIS] Server call failed", err);
      return false;
    }
    // Only clear the overlay after the server confirmed the state flip.
    // The Firestore listener will also see state=active and clear serverClosedState.
    setCrisisTemplate(null);
    setCrisisMeta(null);
    setCrisisBranchOutcome(null);
    setServerClosedState(null);
    return true;
  }, [sessionId]);

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
    resumeCrisis,
    estadoMatriz,
    timerState,
    serverClosedState,
    latenciaMs,
    rateLimit,
    clearRateLimit,
    crisisMeta,
    crisisBranchOutcome,
    chooseCrisisBranch,
  };
}
