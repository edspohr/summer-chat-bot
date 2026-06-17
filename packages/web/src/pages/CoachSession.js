import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useScenario } from "../hooks/useScenario.js";
import { useTagProgress } from "../hooks/useTagProgress.js";
import { useCoachSession } from "../hooks/useCoachSession.js";
import { useSessionTimer } from "../hooks/useSessionTimer.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { TagProgress } from "../components/TagProgress.js";
import { CrisisOverlay } from "../components/CrisisOverlay.js";
import { EmotionalMatrix } from "../components/EmotionalMatrix.js";
// ── Warning text ───────────────────────────────────────────────────────────
const TIMER_WARNINGS = {
    "5min": "Ya llevas 5 minutos. Cuando sientas que la conversación está en un buen punto, puedes ir al informe.",
    "10min": "10 minutos. Es un buen momento para ir cerrando con un compromiso concreto con Martina.",
    "15min": "15 minutos de conversación. Cuando estés listo/a, presiona 'Ir al informe' para ver tu desempeño.",
};
// ── Timer chip ─────────────────────────────────────────────────────────────
function TimerChip({ phase, display }) {
    const base = "text-xs font-secondary font-bold px-3 py-1.5 rounded-full tabular-nums transition-colors";
    const colorMap = {
        idle: "bg-stone-100 text-stone-400",
        running: "bg-summer-teal/20 text-stone-700",
        suggest5: "bg-summer-yellow text-amber-800",
        suggest10: "bg-summer-peach text-orange-800",
        suggest15: "bg-summer-peach text-orange-900",
    };
    return (_jsx("div", { className: `${base} ${colorMap[phase] ?? colorMap["running"]}`, "aria-live": "polite", "aria-label": `Tiempo transcurrido: ${display}`, children: display }));
}
// ── Toast warning ──────────────────────────────────────────────────────────
function TimerWarningToast({ message, onDismiss }) {
    useEffect(() => {
        const id = setTimeout(onDismiss, 6000);
        return () => clearTimeout(id);
    }, [onDismiss]);
    return (_jsx("div", { className: "fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full mx-4", children: _jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 shadow-lg flex items-start gap-3", children: [_jsx("span", { className: "text-amber-500 mt-0.5 flex-shrink-0", children: "\u23F1" }), _jsx("p", { className: "font-secondary text-sm text-amber-900 leading-relaxed", children: message }), _jsx("button", { onClick: onDismiss, className: "ml-auto text-amber-400 hover:text-amber-600 flex-shrink-0 text-lg leading-none", "aria-label": "Cerrar aviso", children: "\u00D7" })] }) }));
}
// ── Context banner ─────────────────────────────────────────────────────────
function ContextBanner({ scenario }) {
    const [expanded, setExpanded] = useState(false);
    return (_jsxs("div", { className: "mb-3 rounded-2xl border border-summer-blue/20 bg-summer-blue/5 text-xs font-secondary overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => setExpanded((v) => !v), className: "w-full flex items-center justify-between px-4 py-3 text-left text-summer-blue font-semibold hover:bg-summer-blue/10 transition-colors", "aria-expanded": expanded, children: [_jsxs("span", { children: ["Lo que sabes sobre ", scenario.persona.name.split(" ")[0]] }), _jsx("span", { className: "text-stone-400 font-normal text-base leading-none", children: expanded ? "▲" : "▼" })] }), expanded && (_jsxs("div", { className: "px-4 pb-4 space-y-2 text-stone-600 leading-relaxed", children: [_jsx("p", { className: "text-stone-500 italic border-t border-summer-blue/10 pt-3", children: scenario.initialSituation }), _jsxs("div", { className: "grid grid-cols-2 gap-x-4 gap-y-1 pt-1", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-stone-700 mb-0.5", children: "Recursos personales" }), _jsxs("ul", { className: "space-y-0.5 text-stone-500 list-disc list-inside", children: [_jsx("li", { children: "Su abuelo paterno" }), _jsx("li", { children: "Amiga Vale (fuera del colegio)" }), _jsx("li", { children: "Cuaderno de dibujo (mochila)" }), _jsx("li", { children: "Hermanita menor" })] })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-stone-700 mb-0.5", children: "Se\u00F1ales observadas" }), _jsxs("ul", { className: "space-y-0.5 text-stone-500 list-disc list-inside", children: [_jsx("li", { children: "Inasistencias repetidas" }), _jsx("li", { children: "Rumores de autolesiones" }), _jsx("li", { children: "Aislamiento progresivo" }), _jsx("li", { children: "Baja en el rendimiento" })] })] })] }), _jsx("p", { className: "text-stone-400 text-[10px] pt-1 border-t border-summer-blue/10", children: "Esta informaci\u00F3n es tuya como docente. Martina no sabe que la tienes." })] }))] }));
}
function ActiveSession({ sessionId, scenario }) {
    const tagProgressItems = useTagProgress(sessionId);
    const completedTagIds = tagProgressItems.filter((t) => t.completed).map((t) => t.tagId);
    const { messages, send, isLoading, crisisTemplate, clearCrisis, estadoMatriz, timerState, timerExpired, latenciaMs } = useCoachSession(sessionId, scenario, completedTagIds, "escenario");
    const [input, setInput] = useState("");
    const [warningMessage, setWarningMessage] = useState(null);
    const bottomRef = useRef(null);
    const navigate = useNavigate();
    // Track last-changed variable for pulse animation
    const [changedVar, setChangedVar] = useState(null);
    const prevMatrixRef = useRef(estadoMatriz);
    useEffect(() => {
        const prev = prevMatrixRef.current;
        if (prev === null || estadoMatriz === null) {
            prevMatrixRef.current = estadoMatriz;
            return;
        }
        if (estadoMatriz.intensidadEmocional !== prev.intensidadEmocional) {
            setChangedVar("intensidadEmocional");
        }
        else if (estadoMatriz.apertura !== prev.apertura) {
            setChangedVar("apertura");
        }
        else if (estadoMatriz.confianzaEnLaAyuda !== prev.confianzaEnLaAyuda) {
            setChangedVar("confianzaEnLaAyuda");
        }
        prevMatrixRef.current = estadoMatriz;
        const t = setTimeout(() => setChangedVar(null), 1200);
        return () => clearTimeout(t);
    }, [estadoMatriz]);
    const handleWarning = useCallback((at) => {
        setWarningMessage(TIMER_WARNINGS[at]);
    }, []);
    const { phase, displayMmSs, syncFromServer } = useSessionTimer(handleWarning);
    // Sync timer whenever we get a new timerState from the server
    useEffect(() => {
        if (timerState !== null)
            syncFromServer(timerState);
    }, [timerState, syncFromServer]);
    // If server signals timer expired (admin-side), still allow navigation manually
    const goToReport = useCallback(() => {
        navigate(`/report/${sessionId}?scenarioId=${scenario.id}`);
    }, [navigate, sessionId, scenario.id]);
    useEffect(() => {
        if (timerExpired)
            goToReport();
    }, [timerExpired, goToReport]);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    const inputLocked = isLoading || crisisTemplate !== null || timerExpired;
    async function handleSend() {
        const text = input.trim();
        if (!text || inputLocked)
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
    return (_jsxs("main", { className: "h-screen flex flex-col bg-warm-bg max-w-2xl mx-auto overflow-hidden", children: [crisisTemplate !== null && (_jsx(CrisisOverlay, { template: crisisTemplate, onConfirmResume: clearCrisis, canResume: true })), warningMessage !== null && (_jsx(TimerWarningToast, { message: warningMessage, onDismiss: () => setWarningMessage(null) })), _jsxs("header", { className: "px-4 py-4 border-b border-stone-100 bg-white space-y-3 shadow-sm z-10 relative", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: () => navigate("/scenarios"), className: "text-stone-400 hover:text-summer-blue text-xl px-1 transition-colors", children: "\u2190" }), _jsx("div", { className: "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-summer-peach/20 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-stone-100", children: scenario.persona.avatarUrl ? (_jsx("img", { src: scenario.persona.avatarUrl, alt: scenario.persona.name, className: "w-full h-full object-cover" })) : (_jsx("span", { className: "text-summer-peach font-bold text-2xl", children: scenario.persona.name.charAt(0) })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "font-title uppercase tracking-wide text-stone-800 text-sm truncate", children: scenario.persona.name }), _jsxs("p", { className: "font-secondary text-xs text-stone-500 truncate", children: [scenario.persona.role, " \u00B7 ", scenario.persona.age, " a\u00F1os"] })] }), _jsx(TimerChip, { phase: phase, display: displayMmSs })] }), _jsx(TagProgress, { items: tagProgressItems })] }), _jsxs("div", { className: "flex flex-1 min-h-0", children: [_jsxs("div", { className: "flex flex-col flex-1 min-w-0", children: [_jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-1", children: [_jsx(ContextBanner, { scenario: scenario }), messages.map((m, i) => (_jsx(ChatBubble, { role: m.role, content: m.content }, i))), isLoading && (_jsx("div", { className: "flex justify-start mb-3", children: _jsx("div", { className: "bg-white border border-stone-200 rounded-2xl px-4 py-2 text-sm text-stone-400", children: "Escribiendo..." }) })), _jsx("div", { ref: bottomRef })] }), _jsxs("div", { className: "border-t border-stone-100 bg-white px-4 pt-3 pb-4 flex flex-col gap-2 shadow-sm z-10 relative", children: [_jsxs("div", { className: "flex gap-3 items-end", children: [_jsx("textarea", { value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: "Escribe tu respuesta...", rows: 1, disabled: inputLocked, className: "flex-1 resize-none rounded-2xl border border-stone-200 bg-warm-bg px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 disabled:opacity-50 transition-all" }), _jsx("button", { onClick: () => void handleSend(), disabled: inputLocked || !input.trim(), className: "bg-summer-blue hover:bg-blue-400 text-white rounded-2xl px-5 py-3 text-sm font-bold font-secondary tracking-wide disabled:opacity-40 transition-colors shadow-sm", children: "Enviar" })] }), _jsx("button", { onClick: goToReport, disabled: isLoading, className: "w-full text-center text-xs font-secondary font-semibold text-stone-400 hover:text-summer-blue hover:bg-summer-blue/5 rounded-xl py-1.5 transition-colors disabled:opacity-40", children: "Ir al informe \u2192" })] })] }), estadoMatriz !== null && (_jsxs("aside", { className: "hidden sm:flex flex-col w-52 border-l border-stone-100 bg-white px-3 py-4 space-y-3 sticky top-0 self-start max-h-screen overflow-y-auto", children: [_jsx("p", { className: "font-title text-[11px] uppercase tracking-wide text-stone-400", children: "Estado emocional" }), _jsx(EmotionalMatrix, { estado: estadoMatriz, changedVar: changedVar })] }))] })] }));
}
export default function CoachSession() {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const scenarioId = searchParams.get("scenarioId") ?? "";
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { scenario, loading: scenarioLoading, error } = useScenario(scenarioId);
    useEffect(() => {
        if (!authLoading && !user)
            navigate("/login");
    }, [user, authLoading, navigate]);
    if (authLoading || scenarioLoading) {
        return (_jsx("main", { className: "min-h-screen flex items-center justify-center bg-warm-bg", children: _jsx("p", { className: "text-stone-400 text-sm", children: "Cargando escenario..." }) }));
    }
    if (error !== null || scenario === null || sessionId === undefined) {
        return (_jsx("main", { className: "min-h-screen flex items-center justify-center bg-warm-bg", children: _jsx("p", { className: "text-sm text-red-500", children: error ?? "Escenario no encontrado" }) }));
    }
    return _jsx(ActiveSession, { sessionId: sessionId, scenario: scenario });
}
