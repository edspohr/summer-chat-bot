import { useState, useCallback } from "react";
import type { ConversationTurn } from "@salvador/shared";
import { callMentorChat } from "../lib/functions.js";

interface LocalMessage {
  role: "user" | "assistant";
  content: string;
}

export function useChat(sessionId: string): {
  messages: LocalMessage[];
  send: (content: string) => Promise<void>;
  isLoading: boolean;
  crisisTemplate: string | null;
  clearCrisis: () => void;
} {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [crisisTemplate, setCrisisTemplate] = useState<string | null>(null);

  const send = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: LocalMessage = { role: "user", content };
    const userTurn: ConversationTurn = { role: "user", content, turnNumber: history.length };

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
      const assistantMsg: LocalMessage = { role: "assistant", content: data.reply };
      const assistantTurn: ConversationTurn = {
        role: "assistant",
        content: data.reply,
        turnNumber: history.length + 1,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (!data.safe) {
        setCrisisTemplate(data.reply);
        setHistory((prev) => [...prev, userTurn]);
      } else {
        setHistory((prev) => [...prev, userTurn, assistantTurn]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, history, isLoading]);

  const clearCrisis = useCallback(() => setCrisisTemplate(null), []);

  return { messages, send, isLoading, crisisTemplate, clearCrisis };
}
