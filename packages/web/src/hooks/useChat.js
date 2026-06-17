import { useState, useCallback } from "react";
import { callMentorChat } from "../lib/functions.js";
export function useChat(sessionId) {
    const [messages, setMessages] = useState([]);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [crisisTemplate, setCrisisTemplate] = useState(null);
    const send = useCallback(async (content) => {
        if (!content.trim() || isLoading)
            return;
        const userMsg = { role: "user", content };
        const userTurn = { role: "user", content, turnNumber: history.length };
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);
        try {
            const result = await callMentorChat({
                userMessage: content,
                sessionId,
                turnNumber: history.length,
                conversationHistory: history,
            });
            const data = result.data;
            const assistantMsg = { role: "assistant", content: data.reply };
            const assistantTurn = {
                role: "assistant",
                content: data.reply,
                turnNumber: history.length + 1,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            if (!data.safe) {
                setCrisisTemplate(data.reply);
                setHistory((prev) => [...prev, userTurn]);
            }
            else {
                setHistory((prev) => [...prev, userTurn, assistantTurn]);
            }
        }
        catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo." },
            ]);
        }
        finally {
            setIsLoading(false);
        }
    }, [sessionId, history, isLoading]);
    const clearCrisis = useCallback(() => setCrisisTemplate(null), []);
    return { messages, send, isLoading, crisisTemplate, clearCrisis };
}
