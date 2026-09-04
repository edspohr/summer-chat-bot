import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "../hooks/useAuth.js";
import { signInAnon } from "../lib/auth.js";
import { callLabChat, type LabChatRequest, type LabChatResponse } from "../lib/functions.js";
import type { LabMode, LabScenario, LabMetrics, LabPromptSnapshot, EstadoMatriz } from "@salvador/shared";
import { EmotionalMatrix } from "../components/EmotionalMatrix.js";
import { ModeToggle } from "../components/ModeToggle.js";
import type { SimulationMode } from "@salvador/shared";

// ── Types ──────────────────────────────────────────────────────────────────

interface LabMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metrics?: LabMetrics;
  promptSnapshot?: LabPromptSnapshot;
  estadoMatriz?: EstadoMatriz | null;
  metricsExpanded: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MODE_LABELS: Record<LabMode, string> = {
  mentor: "Mentor (Summer ChatBot)",
  coach_raw: "Coach sin contexto",
  coach_context: "Coach con contexto",
};

const SCENARIO_LABELS: Record<LabScenario, string> = {
  camila: "Camila (Escenario 01)",
  matias: "Matías (Escenario 02)",
};

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  return `${ms.toLocaleString("es-CL")} ms`;
}

function fmtTokens(n: number): string {
  return n.toLocaleString("es-CL");
}

function fmtCost(usd: number): string {
  return `USD $${usd.toFixed(6)}`;
}

function fmtMode(mode: LabMode): string {
  return MODE_LABELS[mode];
}

function fmtScenario(scenario: LabScenario | undefined, mode: LabMode): string {
  if (mode === "mentor") return "—";
  return scenario !== undefined ? SCENARIO_LABELS[scenario] : "—";
}

// ── MetricsRow ─────────────────────────────────────────────────────────────

function MetricsRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
        {label}
      </td>
      <td className="py-1.5 text-sm text-gray-900 font-mono">{value}</td>
    </tr>
  );
}

// ── MetricsTable ───────────────────────────────────────────────────────────

function MetricsTable({
  metrics,
  promptSnapshot,
  mode,
  scenario,
}: {
  metrics: LabMetrics;
  promptSnapshot: LabPromptSnapshot;
  mode: LabMode;
  scenario?: LabScenario;
}) {
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  return (
    <div>
      <table className="w-full">
        <tbody>
          <MetricsRow label="Latencia total" value={fmtMs(metrics.totalLatencyMs)} />
          <MetricsRow
            label="Primer token"
            value={
              metrics.firstTokenLatencyMs !== undefined
                ? fmtMs(metrics.firstTokenLatencyMs)
                : "—"
            }
          />
          {metrics.characterLatencyMs !== undefined && (
            <MetricsRow label="Personaje (call A)" value={fmtMs(metrics.characterLatencyMs)} />
          )}
          {metrics.evaluatorLatencyMs !== undefined && (
            <MetricsRow label="Evaluador (call B)" value={fmtMs(metrics.evaluatorLatencyMs)} />
          )}
          {metrics.simulationMode !== undefined && (
            <MetricsRow label="Modo simulación" value={metrics.simulationMode} />
          )}
          <MetricsRow label="Tokens entrada" value={fmtTokens(metrics.inputTokens)} />
          <MetricsRow label="Tokens salida" value={fmtTokens(metrics.outputTokens)} />
          <MetricsRow label="Costo estimado" value={fmtCost(metrics.estimatedCostUsd)} />
          <MetricsRow
            label="Safety layer"
            value={metrics.safetyLayerTriggered ?? "—"}
          />
          <MetricsRow label="Modelo" value={metrics.geminiModel} />
          <MetricsRow label="Versión prompt" value={metrics.promptVersion} />
          <MetricsRow label="Región inferencia" value={metrics.region} />
          <MetricsRow label="Modo" value={fmtMode(metrics.mode)} />
          <MetricsRow label="Escenario" value={fmtScenario(scenario, mode)} />
          <MetricsRow
            label="Contexto inyectado"
            value={promptSnapshot.contextInjected ? "Sí" : "No"}
          />
          <MetricsRow
            label="Chunks RAG"
            value={fmtTokens(promptSnapshot.ragChunksUsed)}
          />
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => setSnapshotOpen((o) => !o)}
        className="mt-3 text-xs text-blue-600 hover:text-blue-800 focus:outline-none"
      >
        {snapshotOpen ? "▲ Ocultar snapshot del prompt" : "▼ Ver snapshot del prompt"}
      </button>

      {snapshotOpen && (
        <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono space-y-1">
          <div>System prompt: {fmtTokens(promptSnapshot.systemPromptLength)} chars</div>
          <div>
            Tokens estimados: ~{fmtTokens(promptSnapshot.totalPromptTokensEstimated)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── InlineMetrics (chip + expandable card) ─────────────────────────────────

function InlineMetricsChip({
  metrics,
  expanded,
  onToggle,
}: {
  metrics: LabMetrics;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-1 text-left text-xs text-gray-500 hover:text-gray-700 focus:outline-none"
    >
      ⏱ {fmtMs(metrics.totalLatencyMs)} · 🔤{" "}
      {fmtTokens(metrics.inputTokens)}→{fmtTokens(metrics.outputTokens)} tokens · 💰{" "}
      {fmtCost(metrics.estimatedCostUsd)} · [{fmtMode(metrics.mode)}]
      {expanded ? " ▲" : " ▼"}
    </button>
  );
}

// ── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onToggleMetrics,
}: {
  msg: LabMessage;
  onToggleMetrics: (id: string) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
            isUser
              ? "bg-gray-200 text-gray-900 rounded-br-sm"
              : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
          }`}
        >
          {msg.content}
        </div>

        {!isUser && msg.metrics !== undefined && (
          <div className="mt-0.5 ml-1">
            <InlineMetricsChip
              metrics={msg.metrics}
              expanded={msg.metricsExpanded}
              onToggle={() => onToggleMetrics(msg.id)}
            />

            {msg.metricsExpanded && msg.promptSnapshot !== undefined && (
              <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg text-xs">
                <table className="w-full">
                  <tbody>
                    <MetricsRow
                      label="Latencia total"
                      value={fmtMs(msg.metrics.totalLatencyMs)}
                    />
                    <MetricsRow
                      label="Primer token"
                      value={
                        msg.metrics.firstTokenLatencyMs !== undefined
                          ? fmtMs(msg.metrics.firstTokenLatencyMs)
                          : "—"
                      }
                    />
                    <MetricsRow
                      label="Tokens E→S"
                      value={`${fmtTokens(msg.metrics.inputTokens)} → ${fmtTokens(msg.metrics.outputTokens)}`}
                    />
                    <MetricsRow
                      label="Costo"
                      value={fmtCost(msg.metrics.estimatedCostUsd)}
                    />
                    <MetricsRow
                      label="Safety"
                      value={msg.metrics.safetyLayerTriggered ?? "—"}
                    />
                    {msg.metrics.characterLatencyMs !== undefined && (
                      <MetricsRow
                        label="Personaje"
                        value={fmtMs(msg.metrics.characterLatencyMs)}
                      />
                    )}
                    {msg.metrics.evaluatorLatencyMs !== undefined && (
                      <MetricsRow
                        label="Evaluador"
                        value={fmtMs(msg.metrics.evaluatorLatencyMs)}
                      />
                    )}
                    <MetricsRow
                      label="Contexto"
                      value={msg.promptSnapshot.contextInjected ? "Sí" : "No"}
                    />
                    <MetricsRow
                      label="RAG chunks"
                      value={fmtTokens(msg.promptSnapshot.ragChunksUsed)}
                    />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Export helper ──────────────────────────────────────────────────────────

async function exportSession(sessionId: string, label: string): Promise<void> {
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
  const didAttempt = useRef(false);

  // Access control — open route (facilitator use, not linked publicly).
  // Same pattern as MartinaDemo: silently sign in anonymously so the lab
  // works without a login prompt. The "DEV ONLY" banner (below) is our
  // remaining signal to participants that this is not for them.
  useEffect(() => {
    if (authLoading) return;
    if (user !== null) return;
    if (didAttempt.current) return;
    didAttempt.current = true;
    signInAnon().catch((err) => {
      console.error("[LAB] anon sign-in failed", err);
    });
  }, [authLoading, user]);

  const accessChecked = user !== null;

  // ── Session state ────────────────────────────────────────────────────────

  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [sessionLabel, setSessionLabel] = useState<string>("Sin nombre");
  const [messages, setMessages] = useState<LabMessage[]>([]);

  // ── Mode / scenario controls ─────────────────────────────────────────────

  const [mode, setMode] = useState<LabMode>("mentor");
  const [scenario, setScenario] = useState<LabScenario>("camila");
  const [simulationMode, setSimulationMode] = useState<SimulationMode>("escenario");

  // ── Latest matrix state (escenario + coach_context only) ─────────────────

  const [latestMatrix, setLatestMatrix] = useState<EstadoMatriz | null>(null);
  const [changedVar, setChangedVar] = useState<
    "intensidadEmocional" | "apertura" | "confianzaEnLaAyuda" | null
  >(null);
  const prevMatrixRef = useRef<EstadoMatriz | null>(null);

  // ── Input & loading state ────────────────────────────────────────────────

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const requestStartRef = useRef<number | null>(null);

  // ── Latest metrics (right panel) ─────────────────────────────────────────

  const [latestMetrics, setLatestMetrics] = useState<LabMetrics | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<LabPromptSnapshot | null>(null);

  // ── Session totals ────────────────────────────────────────────────────────

  const assistantMessages = messages.filter(
    (m) => m.role === "assistant" && m.metrics !== undefined
  );
  const totalCost = assistantMessages.reduce(
    (sum, m) => sum + (m.metrics?.estimatedCostUsd ?? 0),
    0
  );
  const avgLatencyMs =
    assistantMessages.length > 0
      ? Math.round(
          assistantMessages.reduce(
            (sum, m) => sum + (m.metrics?.totalLatencyMs ?? 0),
            0
          ) / assistantMessages.length
        )
      : 0;

  // ── Scroll to bottom ──────────────────────────────────────────────────────

  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    if (label === null) return;
    setSessionId(crypto.randomUUID());
    setSessionLabel(label.trim() || "Sin nombre");
    setMessages([]);
    setLatestMetrics(null);
    setLatestSnapshot(null);
    setLatestMatrix(null);
    prevMatrixRef.current = null;
  }

  // ── Mode change resets scenario selection if needed ───────────────────────

  function handleModeChange(newMode: LabMode) {
    setMode(newMode);
    // Reset matrix on mode change
    setLatestMatrix(null);
    prevMatrixRef.current = null;
  }

  function handleSimulationModeChange(newSimMode: SimulationMode) {
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

  const toggleMessageMetrics = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, metricsExpanded: !m.metricsExpanded } : m
      )
    );
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────

  async function handleSend() {
    const text = inputText.trim();
    if (text.length === 0 || isLoading) return;

    const userMsgId = crypto.randomUUID();
    const userMsg: LabMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      metricsExpanded: false,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);
    requestStartRef.current = Date.now();

    const history: Array<{ role: "user" | "assistant"; content: string }> = messages
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    const reqPayload: LabChatRequest & { sessionId: string; simulationMode: SimulationMode } = {
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
      const data = result.data as LabChatResponse;

      // Update matrix state and detect which variable changed for pulse animation
      if (data.estadoMatriz !== undefined && data.estadoMatriz !== null) {
        const prev = prevMatrixRef.current;
        if (prev !== null) {
          if (data.estadoMatriz.intensidadEmocional !== prev.intensidadEmocional) {
            setChangedVar("intensidadEmocional");
          } else if (data.estadoMatriz.apertura !== prev.apertura) {
            setChangedVar("apertura");
          } else if (data.estadoMatriz.confianzaEnLaAyuda !== prev.confianzaEnLaAyuda) {
            setChangedVar("confianzaEnLaAyuda");
          }
          setTimeout(() => setChangedVar(null), 1200);
        }
        prevMatrixRef.current = data.estadoMatriz;
        setLatestMatrix(data.estadoMatriz);
      }

      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: LabMessage = {
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
    } catch (err) {
      console.error("[LAB] Error calling labChat", err);
      const errorMsg: LabMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Error al conectar con el servidor. Revisa la consola para más detalles.",
        metricsExpanded: false,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    try {
      await exportSession(sessionId, sessionLabel);
    } catch (err) {
      console.error("[LAB] Export failed", err);
      alert("Error al exportar la sesión. Revisa la consola.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading || !accessChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="text-sm text-gray-500">Verificando acceso...</span>
      </div>
    );
  }

  const scenarioDisabled = mode === "mentor";
  const matiasDisabled = mode === "coach_context";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-700">Latency Lab</span>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
          DEV ONLY
        </span>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT PANEL — Chat ───────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-200">
          {/* Control bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-3">
            {/* Mode selector */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
              {(["mentor", "coach_raw", "coach_context"] as LabMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModeChange(m)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    mode === m
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>

            {/* Scenario selector */}
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as LabScenario)}
              disabled={scenarioDisabled}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="camila">{SCENARIO_LABELS.camila}</option>
              <option value="matias" disabled={matiasDisabled}>
                {SCENARIO_LABELS.matias}
                {matiasDisabled ? " (no disponible en este modo)" : ""}
              </option>
            </select>

            {/* New session button + label */}
            <div className="flex items-center gap-2 ml-auto">
              {sessionLabel.length > 0 && (
                <span className="text-xs text-gray-400 italic truncate max-w-[140px]">
                  {sessionLabel}
                </span>
              )}
              <button
                type="button"
                onClick={handleNewSession}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Nueva sesión
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-gray-400 text-center">
                  Escribe un mensaje para comenzar.
                  <br />
                  <span className="text-xs">
                    Modo: {fmtMode(mode)}
                    {mode !== "mentor" ? ` · ${SCENARIO_LABELS[scenario]}` : ""}
                  </span>
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onToggleMetrics={toggleMessageMetrics}
              />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-3">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-gray-400 italic">
                  Procesando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="bg-white border-t border-gray-200 px-4 py-3">
            {isLoading && (
              <div className="mb-2 text-xs text-blue-600 font-mono flex items-center gap-1">
                Pensando... {fmtMs(elapsedMs)} ↗
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                style={{ maxHeight: "96px", overflowY: inputText.split("\n").length > 3 ? "auto" : "hidden" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                }}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isLoading || inputText.trim().length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — Métricas + Modo + Matriz ──────────────────────── */}
        <div className="w-80 flex-shrink-0 bg-white overflow-y-auto flex flex-col">
          {/* Mode toggle — only for coach_context */}
          {mode === "coach_context" && (
            <div className="p-4 border-b border-gray-100">
              <ModeToggle
                value={simulationMode}
                onChange={handleSimulationModeChange}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Emotional matrix — only in escenario + coach_context */}
          {mode === "coach_context" && simulationMode === "escenario" && (
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Matriz emocional
              </h2>
              {latestMatrix !== null ? (
                <EmotionalMatrix
                  estado={latestMatrix}
                  showDeltas={true}
                  changedVar={changedVar}
                />
              ) : (
                <p className="text-xs text-gray-400">Envía un turno para ver el estado.</p>
              )}
            </div>
          )}

          {mode === "coach_context" && simulationMode === "promptPuro" && (
            <div className="p-4 border-b border-gray-100">
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium">
                Modo Prompt Puro · sin matriz emocional
              </span>
            </div>
          )}

          <div className="p-4 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Métricas del último mensaje
            </h2>
            {latestMetrics !== null && latestSnapshot !== null ? (
              <MetricsTable
                metrics={latestMetrics}
                promptSnapshot={latestSnapshot}
                mode={mode}
                {...(mode !== "mentor" && { scenario })}
              />
            ) : (
              <p className="text-xs text-gray-400">
                Sin datos aún. Envía un mensaje.
              </p>
            )}
          </div>

          {/* Session summary */}
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Resumen de sesión
            </h2>
            <table className="w-full">
              <tbody>
                <MetricsRow
                  label="Mensajes"
                  value={fmtTokens(assistantMessages.length)}
                />
                <MetricsRow
                  label="Latencia promedio"
                  value={
                    assistantMessages.length > 0 ? fmtMs(avgLatencyMs) : "—"
                  }
                />
                <MetricsRow
                  label="Costo total"
                  value={
                    assistantMessages.length > 0 ? fmtCost(totalCost) : "—"
                  }
                />
              </tbody>
            </table>
          </div>

          {/* Export */}
          <div className="p-4 mt-auto">
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={assistantMessages.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Exportar sesión (JSON)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
