import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "../hooks/useAuth.js";
import { callLabChat } from "../lib/functions.js";
import { EmotionalMatrix } from "../components/EmotionalMatrix.js";
import { ModeToggle } from "../components/ModeToggle.js";
// ── Constants ──────────────────────────────────────────────────────────────
const MODE_LABELS = {
    mentor: "Mentor (Summer ChatBot)",
    coach_raw: "Coach sin contexto",
    coach_context: "Coach con contexto",
};
const SCENARIO_LABELS = {
    camila: "Camila (Escenario 01)",
    matias: "Matías (Escenario 02)",
};
// ── Formatters ─────────────────────────────────────────────────────────────
function fmtMs(ms) {
    return `${ms.toLocaleString("es-CL")} ms`;
}
function fmtTokens(n) {
    return n.toLocaleString("es-CL");
}
function fmtCost(usd) {
    return `USD $${usd.toFixed(6)}`;
}
function fmtMode(mode) {
    return MODE_LABELS[mode];
}
function fmtScenario(scenario, mode) {
    if (mode === "mentor")
        return "—";
    return scenario !== undefined ? SCENARIO_LABELS[scenario] : "—";
}
// ── MetricsRow ─────────────────────────────────────────────────────────────
function MetricsRow({ label, value }) {
    return (_jsxs("tr", { className: "border-b border-gray-100", children: [_jsx("td", { className: "py-1.5 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap", children: label }), _jsx("td", { className: "py-1.5 text-sm text-gray-900 font-mono", children: value })] }));
}
// ── MetricsTable ───────────────────────────────────────────────────────────
function MetricsTable({ metrics, promptSnapshot, mode, scenario, }) {
    const [snapshotOpen, setSnapshotOpen] = useState(false);
    return (_jsxs("div", { children: [_jsx("table", { className: "w-full", children: _jsxs("tbody", { children: [_jsx(MetricsRow, { label: "Latencia total", value: fmtMs(metrics.totalLatencyMs) }), _jsx(MetricsRow, { label: "Primer token", value: metrics.firstTokenLatencyMs !== undefined
                                ? fmtMs(metrics.firstTokenLatencyMs)
                                : "—" }), metrics.characterLatencyMs !== undefined && (_jsx(MetricsRow, { label: "Personaje (call A)", value: fmtMs(metrics.characterLatencyMs) })), metrics.evaluatorLatencyMs !== undefined && (_jsx(MetricsRow, { label: "Evaluador (call B)", value: fmtMs(metrics.evaluatorLatencyMs) })), metrics.simulationMode !== undefined && (_jsx(MetricsRow, { label: "Modo simulaci\u00F3n", value: metrics.simulationMode })), _jsx(MetricsRow, { label: "Tokens entrada", value: fmtTokens(metrics.inputTokens) }), _jsx(MetricsRow, { label: "Tokens salida", value: fmtTokens(metrics.outputTokens) }), _jsx(MetricsRow, { label: "Costo estimado", value: fmtCost(metrics.estimatedCostUsd) }), _jsx(MetricsRow, { label: "Safety layer", value: metrics.safetyLayerTriggered ?? "—" }), _jsx(MetricsRow, { label: "Modelo", value: metrics.geminiModel }), _jsx(MetricsRow, { label: "Versi\u00F3n prompt", value: metrics.promptVersion }), _jsx(MetricsRow, { label: "Regi\u00F3n inferencia", value: metrics.region }), _jsx(MetricsRow, { label: "Modo", value: fmtMode(metrics.mode) }), _jsx(MetricsRow, { label: "Escenario", value: fmtScenario(scenario, mode) }), _jsx(MetricsRow, { label: "Contexto inyectado", value: promptSnapshot.contextInjected ? "Sí" : "No" }), _jsx(MetricsRow, { label: "Chunks RAG", value: fmtTokens(promptSnapshot.ragChunksUsed) })] }) }), _jsx("button", { type: "button", onClick: () => setSnapshotOpen((o) => !o), className: "mt-3 text-xs text-blue-600 hover:text-blue-800 focus:outline-none", children: snapshotOpen ? "▲ Ocultar snapshot del prompt" : "▼ Ver snapshot del prompt" }), snapshotOpen && (_jsxs("div", { className: "mt-2 p-3 bg-gray-50 rounded text-xs font-mono space-y-1", children: [_jsxs("div", { children: ["System prompt: ", fmtTokens(promptSnapshot.systemPromptLength), " chars"] }), _jsxs("div", { children: ["Tokens estimados: ~", fmtTokens(promptSnapshot.totalPromptTokensEstimated)] })] }))] }));
}
// ── InlineMetrics (chip + expandable card) ─────────────────────────────────
function InlineMetricsChip({ metrics, expanded, onToggle, }) {
    return (_jsxs("button", { type: "button", onClick: onToggle, className: "mt-1 text-left text-xs text-gray-500 hover:text-gray-700 focus:outline-none", children: ["\u23F1 ", fmtMs(metrics.totalLatencyMs), " \u00B7 \uD83D\uDD24", " ", fmtTokens(metrics.inputTokens), "\u2192", fmtTokens(metrics.outputTokens), " tokens \u00B7 \uD83D\uDCB0", " ", fmtCost(metrics.estimatedCostUsd), " \u00B7 [", fmtMode(metrics.mode), "]", expanded ? " ▲" : " ▼"] }));
}
// ── MessageBubble ──────────────────────────────────────────────────────────
function MessageBubble({ msg, onToggleMetrics, }) {
    const isUser = msg.role === "user";
    return (_jsx("div", { className: `flex ${isUser ? "justify-end" : "justify-start"} mb-3`, children: _jsxs("div", { className: `max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col`, children: [_jsx("div", { className: `px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${isUser
                        ? "bg-gray-200 text-gray-900 rounded-br-sm"
                        : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"}`, children: msg.content }), !isUser && msg.metrics !== undefined && (_jsxs("div", { className: "mt-0.5 ml-1", children: [_jsx(InlineMetricsChip, { metrics: msg.metrics, expanded: msg.metricsExpanded, onToggle: () => onToggleMetrics(msg.id) }), msg.metricsExpanded && msg.promptSnapshot !== undefined && (_jsx("div", { className: "mt-2 p-3 bg-white border border-gray-200 rounded-lg text-xs", children: _jsx("table", { className: "w-full", children: _jsxs("tbody", { children: [_jsx(MetricsRow, { label: "Latencia total", value: fmtMs(msg.metrics.totalLatencyMs) }), _jsx(MetricsRow, { label: "Primer token", value: msg.metrics.firstTokenLatencyMs !== undefined
                                                ? fmtMs(msg.metrics.firstTokenLatencyMs)
                                                : "—" }), _jsx(MetricsRow, { label: "Tokens E\u2192S", value: `${fmtTokens(msg.metrics.inputTokens)} → ${fmtTokens(msg.metrics.outputTokens)}` }), _jsx(MetricsRow, { label: "Costo", value: fmtCost(msg.metrics.estimatedCostUsd) }), _jsx(MetricsRow, { label: "Safety", value: msg.metrics.safetyLayerTriggered ?? "—" }), msg.metrics.characterLatencyMs !== undefined && (_jsx(MetricsRow, { label: "Personaje", value: fmtMs(msg.metrics.characterLatencyMs) })), msg.metrics.evaluatorLatencyMs !== undefined && (_jsx(MetricsRow, { label: "Evaluador", value: fmtMs(msg.metrics.evaluatorLatencyMs) })), _jsx(MetricsRow, { label: "Contexto", value: msg.promptSnapshot.contextInjected ? "Sí" : "No" }), _jsx(MetricsRow, { label: "RAG chunks", value: fmtTokens(msg.promptSnapshot.ragChunksUsed) })] }) }) }))] }))] }) }));
}
// ── Export helper ──────────────────────────────────────────────────────────
async function exportSession(sessionId, label) {
    const sessionRef = doc(db, "lab_sessions", sessionId);
    const [sessionSnap, messagesSnap] = await Promise.all([
        getDoc(sessionRef),
        getDocs(collection(db, "lab_sessions", sessionId, "messages")),
    ]);
    const data = {
        session: sessionSnap.exists() ? sessionSnap.data() : null,
        messages: messagesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = label.replace(/[^a-z0-9-_]/gi, "-").toLowerCase() || "sin-nombre";
    a.href = url;
    a.download = `lab-session-${safeName}-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
// ── LabChat page ───────────────────────────────────────────────────────────
export default function LabChat() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    // Access control — checked on mount once auth resolves
    const [accessChecked, setAccessChecked] = useState(false);
    useEffect(() => {
        if (authLoading)
            return;
        if (user === null) {
            navigate("/login");
            return;
        }
        getDoc(doc(db, "users", user.uid))
            .then((snap) => {
            const role = snap.data()?.role;
            if (role !== "admin") {
                navigate("/");
                return;
            }
            setAccessChecked(true);
        })
            .catch(() => navigate("/"));
    }, [user, authLoading, navigate]);
    // ── Session state ────────────────────────────────────────────────────────
    const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
    const [sessionLabel, setSessionLabel] = useState("Sin nombre");
    const [messages, setMessages] = useState([]);
    // ── Mode / scenario controls ─────────────────────────────────────────────
    const [mode, setMode] = useState("mentor");
    const [scenario, setScenario] = useState("camila");
    const [simulationMode, setSimulationMode] = useState("escenario");
    // ── Latest matrix state (escenario + coach_context only) ─────────────────
    const [latestMatrix, setLatestMatrix] = useState(null);
    const [changedVar, setChangedVar] = useState(null);
    const prevMatrixRef = useRef(null);
    // ── Input & loading state ────────────────────────────────────────────────
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const requestStartRef = useRef(null);
    // ── Latest metrics (right panel) ─────────────────────────────────────────
    const [latestMetrics, setLatestMetrics] = useState(null);
    const [latestSnapshot, setLatestSnapshot] = useState(null);
    // ── Session totals ────────────────────────────────────────────────────────
    const assistantMessages = messages.filter((m) => m.role === "assistant" && m.metrics !== undefined);
    const totalCost = assistantMessages.reduce((sum, m) => sum + (m.metrics?.estimatedCostUsd ?? 0), 0);
    const avgLatencyMs = assistantMessages.length > 0
        ? Math.round(assistantMessages.reduce((sum, m) => sum + (m.metrics?.totalLatencyMs ?? 0), 0) / assistantMessages.length)
        : 0;
    // ── Scroll to bottom ──────────────────────────────────────────────────────
    const messagesEndRef = useRef(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    // ── Live timer ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isLoading) {
            setElapsedMs(0);
            return;
        }
        const interval = setInterval(() => {
            if (requestStartRef.current !== null) {
                setElapsedMs(Date.now() - requestStartRef.current);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [isLoading]);
    // ── New session ───────────────────────────────────────────────────────────
    function handleNewSession() {
        const label = window.prompt("Nombre de la sesión:", sessionLabel);
        if (label === null)
            return;
        setSessionId(crypto.randomUUID());
        setSessionLabel(label.trim() || "Sin nombre");
        setMessages([]);
        setLatestMetrics(null);
        setLatestSnapshot(null);
        setLatestMatrix(null);
        prevMatrixRef.current = null;
    }
    // ── Mode change resets scenario selection if needed ───────────────────────
    function handleModeChange(newMode) {
        setMode(newMode);
        // Reset matrix on mode change
        setLatestMatrix(null);
        prevMatrixRef.current = null;
    }
    function handleSimulationModeChange(newSimMode) {
        // ModeToggle already confirmed with user before calling this
        setSimulationMode(newSimMode);
        setSessionId(crypto.randomUUID());
        setMessages([]);
        setLatestMetrics(null);
        setLatestSnapshot(null);
        setLatestMatrix(null);
        prevMatrixRef.current = null;
    }
    // ── Toggle metrics chip ───────────────────────────────────────────────────
    const toggleMessageMetrics = useCallback((id) => {
        setMessages((prev) => prev.map((m) => m.id === id ? { ...m, metricsExpanded: !m.metricsExpanded } : m));
    }, []);
    // ── Send message ──────────────────────────────────────────────────────────
    async function handleSend() {
        const text = inputText.trim();
        if (text.length === 0 || isLoading)
            return;
        const userMsgId = crypto.randomUUID();
        const userMsg = {
            id: userMsgId,
            role: "user",
            content: text,
            metricsExpanded: false,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInputText("");
        setIsLoading(true);
        requestStartRef.current = Date.now();
        const history = messages
            .slice(-20)
            .map((m) => ({ role: m.role, content: m.content }));
        const reqPayload = {
            message: text,
            mode,
            simulationMode,
            ...(mode !== "mentor" && { scenario }),
            conversationHistory: history,
            promptVersion: mode === "mentor" ? "mentor_v1" : "coach_conversational_v1",
            sessionLabel,
            sessionId,
        };
        try {
            const result = await callLabChat(reqPayload);
            const data = result.data;
            // Update matrix state and detect which variable changed for pulse animation
            if (data.estadoMatriz !== undefined && data.estadoMatriz !== null) {
                const prev = prevMatrixRef.current;
                if (prev !== null) {
                    if (data.estadoMatriz.intensidadEmocional !== prev.intensidadEmocional) {
                        setChangedVar("intensidadEmocional");
                    }
                    else if (data.estadoMatriz.apertura !== prev.apertura) {
                        setChangedVar("apertura");
                    }
                    else if (data.estadoMatriz.confianzaEnLaAyuda !== prev.confianzaEnLaAyuda) {
                        setChangedVar("confianzaEnLaAyuda");
                    }
                    setTimeout(() => setChangedVar(null), 1200);
                }
                prevMatrixRef.current = data.estadoMatriz;
                setLatestMatrix(data.estadoMatriz);
            }
            const assistantMsgId = crypto.randomUUID();
            const assistantMsg = {
                id: assistantMsgId,
                role: "assistant",
                content: data.content,
                metrics: data.metrics,
                promptSnapshot: data.promptSnapshot,
                estadoMatriz: data.estadoMatriz ?? null,
                metricsExpanded: false,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setLatestMetrics(data.metrics);
            setLatestSnapshot(data.promptSnapshot);
            // Sync sessionId from server (in case server generated a new one)
            if (data.sessionId !== sessionId) {
                setSessionId(data.sessionId);
            }
        }
        catch (err) {
            console.error("[LAB] Error calling labChat", err);
            const errorMsg = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "Error al conectar con el servidor. Revisa la consola para más detalles.",
                metricsExpanded: false,
            };
            setMessages((prev) => [...prev, errorMsg]);
        }
        finally {
            setIsLoading(false);
        }
    }
    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    }
    // ── Export ────────────────────────────────────────────────────────────────
    async function handleExport() {
        try {
            await exportSession(sessionId, sessionLabel);
        }
        catch (err) {
            console.error("[LAB] Export failed", err);
            alert("Error al exportar la sesión. Revisa la consola.");
        }
    }
    // ── Render ────────────────────────────────────────────────────────────────
    if (authLoading || !accessChecked) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("span", { className: "text-sm text-gray-500", children: "Verificando acceso..." }) }));
    }
    const scenarioDisabled = mode === "mentor";
    const matiasDisabled = mode === "coach_context";
    return (_jsxs("div", { className: "min-h-screen bg-gray-50 flex flex-col", children: [_jsxs("div", { className: "bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3", children: [_jsx("span", { className: "text-sm font-semibold text-gray-700", children: "Latency Lab" }), _jsx("span", { className: "text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium", children: "DEV ONLY" })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("div", { className: "flex flex-col flex-1 min-w-0 border-r border-gray-200", children: [_jsxs("div", { className: "bg-white border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-3", children: [_jsx("div", { className: "flex rounded-lg border border-gray-300 overflow-hidden text-xs", children: ["mentor", "coach_raw", "coach_context"].map((m) => (_jsx("button", { type: "button", onClick: () => handleModeChange(m), className: `px-3 py-1.5 font-medium transition-colors ${mode === m
                                                ? "bg-blue-600 text-white"
                                                : "bg-white text-gray-600 hover:bg-gray-50"}`, children: MODE_LABELS[m] }, m))) }), _jsxs("select", { value: scenario, onChange: (e) => setScenario(e.target.value), disabled: scenarioDisabled, className: "text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "camila", children: SCENARIO_LABELS.camila }), _jsxs("option", { value: "matias", disabled: matiasDisabled, children: [SCENARIO_LABELS.matias, matiasDisabled ? " (no disponible en este modo)" : ""] })] }), _jsxs("div", { className: "flex items-center gap-2 ml-auto", children: [sessionLabel.length > 0 && (_jsx("span", { className: "text-xs text-gray-400 italic truncate max-w-[140px]", children: sessionLabel })), _jsx("button", { type: "button", onClick: handleNewSession, className: "text-xs px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors", children: "Nueva sesi\u00F3n" })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-4", children: [messages.length === 0 && (_jsx("div", { className: "h-full flex items-center justify-center", children: _jsxs("p", { className: "text-sm text-gray-400 text-center", children: ["Escribe un mensaje para comenzar.", _jsx("br", {}), _jsxs("span", { className: "text-xs", children: ["Modo: ", fmtMode(mode), mode !== "mentor" ? ` · ${SCENARIO_LABELS[scenario]}` : ""] })] }) })), messages.map((msg) => (_jsx(MessageBubble, { msg: msg, onToggleMetrics: toggleMessageMetrics }, msg.id))), isLoading && (_jsx("div", { className: "flex justify-start mb-3", children: _jsx("div", { className: "bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-gray-400 italic", children: "Procesando..." }) })), _jsx("div", { ref: messagesEndRef })] }), _jsxs("div", { className: "bg-white border-t border-gray-200 px-4 py-3", children: [isLoading && (_jsxs("div", { className: "mb-2 text-xs text-blue-600 font-mono flex items-center gap-1", children: ["Pensando... ", fmtMs(elapsedMs), " \u2197"] })), _jsxs("div", { className: "flex gap-2", children: [_jsx("textarea", { value: inputText, onChange: (e) => setInputText(e.target.value), onKeyDown: handleKeyDown, disabled: isLoading, placeholder: "Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva l\u00EDnea)", rows: 1, className: "flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden", style: { maxHeight: "96px", overflowY: inputText.split("\n").length > 3 ? "auto" : "hidden" }, onInput: (e) => {
                                                    const el = e.currentTarget;
                                                    el.style.height = "auto";
                                                    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                                                } }), _jsx("button", { type: "button", onClick: () => void handleSend(), disabled: isLoading || inputText.trim().length === 0, className: "px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: "Enviar" })] })] })] }), _jsxs("div", { className: "w-80 flex-shrink-0 bg-white overflow-y-auto flex flex-col", children: [mode === "coach_context" && (_jsx("div", { className: "p-4 border-b border-gray-100", children: _jsx(ModeToggle, { value: simulationMode, onChange: handleSimulationModeChange, disabled: isLoading }) })), mode === "coach_context" && simulationMode === "escenario" && (_jsxs("div", { className: "p-4 border-b border-gray-100", children: [_jsx("h2", { className: "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3", children: "Matriz emocional" }), latestMatrix !== null ? (_jsx(EmotionalMatrix, { estado: latestMatrix, showDeltas: true, changedVar: changedVar })) : (_jsx("p", { className: "text-xs text-gray-400", children: "Env\u00EDa un turno para ver el estado." }))] })), mode === "coach_context" && simulationMode === "promptPuro" && (_jsx("div", { className: "p-4 border-b border-gray-100", children: _jsx("span", { className: "text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium", children: "Modo Prompt Puro \u00B7 sin matriz emocional" }) })), _jsxs("div", { className: "p-4 border-b border-gray-100", children: [_jsx("h2", { className: "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3", children: "M\u00E9tricas del \u00FAltimo mensaje" }), latestMetrics !== null && latestSnapshot !== null ? (_jsx(MetricsTable, { metrics: latestMetrics, promptSnapshot: latestSnapshot, mode: mode, ...(mode !== "mentor" && { scenario }) })) : (_jsx("p", { className: "text-xs text-gray-400", children: "Sin datos a\u00FAn. Env\u00EDa un mensaje." }))] }), _jsxs("div", { className: "p-4 border-b border-gray-100", children: [_jsx("h2", { className: "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3", children: "Resumen de sesi\u00F3n" }), _jsx("table", { className: "w-full", children: _jsxs("tbody", { children: [_jsx(MetricsRow, { label: "Mensajes", value: fmtTokens(assistantMessages.length) }), _jsx(MetricsRow, { label: "Latencia promedio", value: assistantMessages.length > 0 ? fmtMs(avgLatencyMs) : "—" }), _jsx(MetricsRow, { label: "Costo total", value: assistantMessages.length > 0 ? fmtCost(totalCost) : "—" })] }) })] }), _jsx("div", { className: "p-4 mt-auto", children: _jsx("button", { type: "button", onClick: () => void handleExport(), disabled: assistantMessages.length === 0, className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: "Exportar sesi\u00F3n (JSON)" }) })] })] })] }));
}
