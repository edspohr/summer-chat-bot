import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { CrisisOverlay } from "../components/CrisisOverlay.js";
const SESSION_ID = crypto.randomUUID();
export default function MentorChat() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const { messages, send, isLoading, crisisTemplate, clearCrisis } = useChat(SESSION_ID);
    const [input, setInput] = useState("");
    const bottomRef = useRef(null);
    useEffect(() => {
        if (!loading && !user)
            navigate("/login");
    }, [user, loading, navigate]);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    async function handleSend() {
        const text = input.trim();
        if (!text)
            return;
        setInput("");
        await send(text);
    }
    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    }
    return (_jsx("main", { className: "min-h-screen flex flex-col bg-warm-bg", children: _jsxs("div", { className: "flex-1 flex flex-col max-w-2xl mx-auto w-full bg-white shadow-xl sm:my-4 sm:rounded-[2.5rem] overflow-hidden border border-stone-100", children: [crisisTemplate !== null && (_jsx(CrisisOverlay, { template: crisisTemplate, onConfirmResume: clearCrisis, canResume: true })), _jsxs("header", { className: "px-6 py-4 border-b border-stone-100 bg-white flex items-center gap-4 relative z-10 shadow-sm", children: [_jsx("button", { onClick: () => navigate("/"), className: "w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-summer-blue hover:bg-summer-blue/10 transition-all", children: "\u2190" }), _jsx("div", { className: "w-12 h-12 rounded-2xl bg-summer-teal/20 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-stone-100", children: _jsx("img", { src: "/avatar-mentor.jpg", alt: "Summer ChatBot", className: "w-full h-full object-cover" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h1", { className: "font-title uppercase tracking-wide text-stone-800 text-sm truncate", children: "Modo Mentor" }), _jsx("p", { className: "font-secondary text-xs text-summer-teal font-bold uppercase tracking-tight", children: "Summer ChatBot" })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-1", children: [messages.length === 0 && (_jsxs("div", { className: "mt-20 mx-auto max-w-xs text-center space-y-6 px-6", children: [_jsx("div", { className: "w-28 h-28 sm:w-36 sm:h-36 rounded-[2.5rem] bg-summer-teal/10 flex items-center justify-center mx-auto shadow-inner overflow-hidden border-2 border-summer-teal/20 group", children: _jsx("img", { src: "/avatar-mentor.jpg", alt: "Summer ChatBot", className: "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "font-title uppercase tracking-wide text-stone-800 text-lg", children: "\u00BFC\u00F3mo puedo ayudarte?" }), _jsx("p", { className: "font-secondary text-sm text-stone-500 leading-relaxed", children: "Preg\u00FAntame sobre la metodolog\u00EDa OASIS, las fases del proceso o c\u00F3mo prepararte para el Modo Coach." })] })] })), messages.map((m, i) => (_jsx(ChatBubble, { role: m.role, content: m.content }, i))), isLoading && (_jsx("div", { className: "flex justify-start mb-4", children: _jsx("div", { className: "bg-stone-50 border border-stone-100 rounded-2xl px-5 py-3 text-sm text-stone-400 font-secondary animate-pulse", children: "Summer ChatBot est\u00E1 escribiendo..." }) })), _jsx("div", { ref: bottomRef })] }), _jsx("div", { className: "border-t border-stone-100 bg-white px-6 py-4", children: _jsxs("div", { className: "flex gap-3 items-end max-w-3xl mx-auto w-full", children: [_jsx("textarea", { value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: "Escribe tu pregunta sobre OASIS...", rows: 1, disabled: isLoading || crisisTemplate !== null, className: "flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-teal/50 transition-all disabled:opacity-50" }), _jsx("button", { onClick: () => void handleSend(), disabled: isLoading || !input.trim() || crisisTemplate !== null, className: "bg-summer-teal hover:bg-teal-400 text-white rounded-2xl p-3 w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-40 transition-all hover:scale-105 active:scale-95", children: _jsx("span", { className: "text-xl", children: "\u2192" }) })] }) })] }) }));
}
