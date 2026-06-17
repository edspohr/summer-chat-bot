import { useState, useCallback, useRef } from "react";
import { INITIAL_MATRIX } from "@salvador/shared";
import { callCoachTurn } from "../lib/functions.js";
export function useCoachSession(sessionId, scenario, completedTagIds, modo = "escenario") {
    const allTagIds = scenario.requiredTags.map((t) => t.tagId);
    const initialEmotionalState = {
        emotionalIntensity: scenario.emotionalStateVariables.emotionalIntensity.initial,
        openness: scenario.emotionalStateVariables.openness.initial,
        trustInHelp: scenario.emotionalStateVariables.trustInHelp.initial,
    };
    const seedMessage = { role: "assistant", content: scenario.seedMessage };
    const [messages, setMessages] = useState([seedMessage]);
    const [history, setHistory] = useState([
        { role: "assistant", content: scenario.seedMessage, turnNumber: 0 },
    ]);
    const [turnNumber, setTurnNumber] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [crisisTemplate, setCrisisTemplate] = useState(null);
    // Server-authoritative matrix and timer state
    const [estadoMatriz, setEstadoMatriz] = useState(modo === "escenario"
        ? { ...INITIAL_MATRIX, pisoIntensidadActivo: true, derivacionAcordada: false }
        : null);
    const [timerState, setTimerState] = useState(null);
    const [timerExpired, setTimerExpired] = useState(false);
    const [latenciaMs, setLatenciaMs] = useState(null);
    // Refs for values that change frequently — avoids stale closures in send callback
    const completedTagIdsRef = useRef(completedTagIds);
    completedTagIdsRef.current = completedTagIds;
    const historyRef = useRef(history);
    historyRef.current = history;
    const turnNumberRef = useRef(turnNumber);
    turnNumberRef.current = turnNumber;
    const send = useCallback(async (content) => {
        if (!content.trim())
            return;
        const currentHistory = historyRef.current;
        const currentTurnNumber = turnNumberRef.current;
        const currentPendingTagIds = allTagIds.filter((id) => !completedTagIdsRef.current.includes(id));
        const userMsg = { role: "user", content };
        const userTurn = { role: "user", content, turnNumber: currentTurnNumber };
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
            });
            const data = result.data;
            // Update server-authoritative state
            if (data.estadoMatriz !== null)
                setEstadoMatriz(data.estadoMatriz);
            if (data.timerState !== null)
                setTimerState(data.timerState);
            if (data.latenciaMs !== null)
                setLatenciaMs(data.latenciaMs);
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
            const assistantMsg = { role: "assistant", content: data.reply };
            setMessages((prev) => [...prev, assistantMsg]);
            if (!data.safe) {
                setCrisisTemplate(data.reply);
                setHistory((prev) => [...prev, userTurn]);
                setTurnNumber((n) => n + 1);
            }
            else {
                const assistantTurn = {
                    role: "assistant",
                    content: data.reply,
                    turnNumber: currentTurnNumber + 1,
                };
                setHistory((prev) => [...prev, userTurn, assistantTurn]);
                setTurnNumber((n) => n + 2);
            }
        }
        catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Ocurrió un error. Por favor intenta de nuevo." },
            ]);
        }
        finally {
            setIsLoading(false);
        }
    }, [sessionId, scenario.id, modo]); // eslint-disable-line react-hooks/exhaustive-deps
    const clearCrisis = useCallback(() => setCrisisTemplate(null), []);
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
    };
}
