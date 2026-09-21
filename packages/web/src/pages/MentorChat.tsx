import { useRef, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { CrisisOverlay } from "../components/CrisisOverlay.js";
import { HelpButton } from "../components/HelpButton.js";
import { Composer } from "../components/Composer.js";

const SESSION_ID = crypto.randomUUID();

export default function MentorChat() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { messages, send, isLoading, crisisTemplate, clearCrisis } = useChat(SESSION_ID);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await send(text);
  }

  return (
    <main className="min-h-screen flex flex-col bg-warm-bg">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full bg-white shadow-xl sm:my-4 sm:rounded-[2.5rem] overflow-hidden border border-stone-100">
      {crisisTemplate !== null && (
        <CrisisOverlay
          template={crisisTemplate}
          onConfirmResume={clearCrisis}
          canResume={true}
        />
      )}

      <header className="px-6 py-4 border-b border-stone-100 bg-white flex items-center gap-4 relative z-10 shadow-sm">
        <button
          onClick={() => navigate("/inicio")}
          className="flex items-center gap-1 px-3 h-10 rounded-full text-stone-500 hover:text-summer-blue hover:bg-summer-blue/10 transition-all text-sm font-secondary"
          aria-label="Volver al inicio"
        >
          <span aria-hidden="true">←</span>
          <span>Inicio</span>
        </button>
        <div className="w-12 h-12 rounded-2xl bg-summer-teal/20 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-stone-100">
          <img src="/avatar-mentor.jpg" alt="Summer ChatBot" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-title uppercase tracking-wide text-stone-800 text-sm truncate">Modo Mentor</h1>
          <p className="font-secondary text-xs text-summer-teal font-bold uppercase tracking-tight">Summer ChatBot</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="mt-20 mx-auto max-w-xs text-center space-y-6 px-6">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-[2.5rem] bg-summer-teal/10 flex items-center justify-center mx-auto shadow-inner overflow-hidden border-2 border-summer-teal/20 group">
               <img 
                 src="/avatar-mentor.jpg" 
                 alt="Summer ChatBot" 
                 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
               />
            </div>
            <div className="space-y-2">
              <p className="font-title uppercase tracking-wide text-stone-800 text-lg">¿Cómo puedo ayudarte?</p>
              <p className="font-secondary text-sm text-stone-500 leading-relaxed">
                Pregúntame sobre la metodología OASIS, las fases del proceso o cómo prepararte para el Modo Coach.
              </p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-stone-50 border border-stone-100 rounded-2xl px-5 py-3 text-sm text-stone-400 font-secondary animate-pulse">
              Summer ChatBot está escribiendo...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-stone-100 bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto w-full">
          <Composer
            value={input}
            onChange={setInput}
            onSend={() => void handleSend()}
            disabled={isLoading || crisisTemplate !== null}
            placeholder="Escribe tu pregunta sobre OASIS..."
            variant="mentor"
          />
        </div>
      </div>
    </div>
      <HelpButton />
    </main>
  );
}
