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
import type { Scenario } from "@salvador/shared";

// ── Warning text ───────────────────────────────────────────────────────────
const TIMER_WARNINGS = {
  "5min":
    "Ya llevas 5 minutos. Cuando sientas que la conversación está en un buen punto, puedes ir al informe.",
  "10min":
    "10 minutos. Es un buen momento para ir cerrando con un compromiso concreto con Martina.",
  "15min":
    "15 minutos de conversación. Cuando estés listo/a, presiona 'Ir al informe' para ver tu desempeño.",
} as const;

// ── Timer chip ─────────────────────────────────────────────────────────────

function TimerChip({ phase, display }: { phase: string; display: string }) {
  const base = "text-xs font-secondary font-bold px-3 py-1.5 rounded-full tabular-nums transition-colors";
  const colorMap: Record<string, string> = {
    idle: "bg-stone-100 text-stone-400",
    running: "bg-summer-teal/20 text-stone-700",
    suggest5: "bg-summer-yellow text-amber-800",
    suggest10: "bg-summer-peach text-orange-800",
    suggest15: "bg-summer-peach text-orange-900",
  };
  return (
    <div
      className={`${base} ${colorMap[phase] ?? colorMap["running"]}`}
      aria-live="polite"
      aria-label={`Tiempo transcurrido: ${display}`}
    >
      {display}
    </div>
  );
}

// ── Toast warning ──────────────────────────────────────────────────────────

function TimerWarningToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 6000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full mx-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 shadow-lg flex items-start gap-3">
        <span className="text-amber-500 mt-0.5 flex-shrink-0">⏱</span>
        <p className="font-secondary text-sm text-amber-900 leading-relaxed">{message}</p>
        <button
          onClick={onDismiss}
          className="ml-auto text-amber-400 hover:text-amber-600 flex-shrink-0 text-lg leading-none"
          aria-label="Cerrar aviso"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Context banner ─────────────────────────────────────────────────────────

function ContextBanner({ scenario }: { scenario: Scenario }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-3 rounded-2xl border border-summer-blue/20 bg-summer-blue/5 text-xs font-secondary overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-summer-blue font-semibold hover:bg-summer-blue/10 transition-colors"
        aria-expanded={expanded}
      >
        <span>Lo que sabes sobre {scenario.persona.name.split(" ")[0]}</span>
        <span className="text-stone-400 font-normal text-base leading-none">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2 text-stone-600 leading-relaxed">
          <p className="text-stone-500 italic border-t border-summer-blue/10 pt-3">{scenario.initialSituation}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
            <div>
              <p className="font-semibold text-stone-700 mb-0.5">Recursos personales</p>
              <ul className="space-y-0.5 text-stone-500 list-disc list-inside">
                <li>Su abuelo paterno</li>
                <li>Amiga Vale (fuera del colegio)</li>
                <li>Cuaderno de dibujo (mochila)</li>
                <li>Hermanita menor</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-stone-700 mb-0.5">Señales observadas</p>
              <ul className="space-y-0.5 text-stone-500 list-disc list-inside">
                <li>Inasistencias repetidas</li>
                <li>Rumores de autolesiones</li>
                <li>Aislamiento progresivo</li>
                <li>Baja en el rendimiento</li>
              </ul>
            </div>
          </div>
          <p className="text-stone-400 text-[10px] pt-1 border-t border-summer-blue/10">
            Esta información es tuya como docente. Martina no sabe que la tienes.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Active session ─────────────────────────────────────────────────────────

interface ActiveSessionProps {
  sessionId: string;
  scenario: Scenario;
}

function ActiveSession({ sessionId, scenario }: ActiveSessionProps) {
  const allTagIds = scenario.requiredTags.map((t) => t.tagId);
  const tagProgressItems = useTagProgress(sessionId, allTagIds);
  const completedTagIds = tagProgressItems.filter((t) => t.completed).map((t) => t.tagId);

  const { messages, send, isLoading, crisisTemplate, clearCrisis, estadoMatriz, timerState, timerExpired, latenciaMs } =
    useCoachSession(sessionId, scenario, completedTagIds, "escenario");

  const [input, setInput] = useState("");
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Track which variables changed this turn (multiple can change simultaneously).
  // Also track per-variable delta sign so the bar can show a directional color cue.
  type MatrixVarKey = "intensidadEmocional" | "apertura" | "confianzaEnLaAyuda";
  const [changedVars, setChangedVars] = useState<Set<MatrixVarKey>>(new Set());
  const [deltaSign, setDeltaSign] = useState<Record<MatrixVarKey, "good" | "bad" | "none">>({
    intensidadEmocional: "none",
    apertura: "none",
    confianzaEnLaAyuda: "none",
  });
  const prevMatrixRef = useRef(estadoMatriz);
  useEffect(() => {
    const prev = prevMatrixRef.current;
    if (prev === null || estadoMatriz === null) {
      prevMatrixRef.current = estadoMatriz;
      return;
    }
    const changed = new Set<MatrixVarKey>();
    const signs: Record<MatrixVarKey, "good" | "bad" | "none"> = {
      intensidadEmocional: "none",
      apertura: "none",
      confianzaEnLaAyuda: "none",
    };
    if (estadoMatriz.intensidadEmocional !== prev.intensidadEmocional) {
      changed.add("intensidadEmocional");
      // For intensity, DOWN is good (calming Martina)
      signs.intensidadEmocional =
        estadoMatriz.intensidadEmocional < prev.intensidadEmocional ? "good" : "bad";
    }
    if (estadoMatriz.apertura !== prev.apertura) {
      changed.add("apertura");
      signs.apertura = estadoMatriz.apertura > prev.apertura ? "good" : "bad";
    }
    if (estadoMatriz.confianzaEnLaAyuda !== prev.confianzaEnLaAyuda) {
      changed.add("confianzaEnLaAyuda");
      signs.confianzaEnLaAyuda = estadoMatriz.confianzaEnLaAyuda > prev.confianzaEnLaAyuda ? "good" : "bad";
    }
    if (changed.size > 0) {
      setChangedVars(changed);
      setDeltaSign(signs);
      const t = setTimeout(() => {
        setChangedVars(new Set());
        setDeltaSign({ intensidadEmocional: "none", apertura: "none", confianzaEnLaAyuda: "none" });
      }, 1200);
      prevMatrixRef.current = estadoMatriz;
      return () => clearTimeout(t);
    }
    prevMatrixRef.current = estadoMatriz;
  }, [estadoMatriz]);

  const handleWarning = useCallback((at: "5min" | "10min" | "15min") => {
    setWarningMessage(TIMER_WARNINGS[at]);
  }, []);

  const { phase, displayMmSs, syncFromServer } = useSessionTimer(handleWarning);

  // Sync timer whenever we get a new timerState from the server
  useEffect(() => {
    if (timerState !== null) syncFromServer(timerState);
  }, [timerState, syncFromServer]);

  // If server signals timer expired (admin-side), still allow navigation manually
  const goToReport = useCallback(() => {
    navigate(`/report/${sessionId}?scenarioId=${scenario.id}`);
  }, [navigate, sessionId, scenario.id]);

  useEffect(() => {
    if (timerExpired) goToReport();
  }, [timerExpired, goToReport]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const inputLocked = isLoading || crisisTemplate !== null || timerExpired;

  async function handleSend() {
    const text = input.trim();
    if (!text || inputLocked) return;
    setInput("");
    await send(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <main className="h-screen flex flex-col bg-warm-bg max-w-2xl mx-auto overflow-hidden">
      {crisisTemplate !== null && (
        <CrisisOverlay template={crisisTemplate} onConfirmResume={clearCrisis} canResume={true} />
      )}

      {warningMessage !== null && (
        <TimerWarningToast message={warningMessage} onDismiss={() => setWarningMessage(null)} />
      )}

      <header className="px-4 py-4 border-b border-stone-100 bg-white space-y-3 shadow-sm z-10 relative">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/scenarios")}
            className="text-stone-400 hover:text-summer-blue text-xl px-1 transition-colors"
          >
            ←
          </button>
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-summer-peach/20 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-stone-100">
            {scenario.persona.avatarUrl ? (
              <img
                src={scenario.persona.avatarUrl}
                alt={scenario.persona.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-summer-peach font-bold text-2xl">
                {scenario.persona.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-title uppercase tracking-wide text-stone-800 text-sm truncate">
              {scenario.persona.name}
            </p>
            <p className="font-secondary text-xs text-stone-500 truncate">
              {scenario.persona.role} · {scenario.persona.age} años
            </p>
          </div>
          <TimerChip phase={phase} display={displayMmSs} />
        </div>
        <TagProgress items={tagProgressItems} />
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            <ContextBanner scenario={scenario} />
            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} content={m.content} />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-3">
                <div className="bg-white border border-stone-200 rounded-2xl px-4 py-2 text-sm text-stone-400">
                  Escribiendo...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-stone-100 bg-white px-4 pt-3 pb-4 flex gap-3 items-end shadow-sm z-10 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta..."
              rows={1}
              disabled={inputLocked}
              className="flex-1 resize-none rounded-2xl border border-stone-200 bg-warm-bg px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 disabled:opacity-50 transition-all"
            />
            <button
              onClick={() => void handleSend()}
              disabled={inputLocked || !input.trim()}
              className="bg-summer-blue hover:bg-blue-400 text-white rounded-2xl px-5 py-3 text-sm font-bold font-secondary tracking-wide disabled:opacity-40 transition-colors shadow-sm"
            >
              Enviar
            </button>
          </div>
        </div>

        {/* Emotional matrix side panel — sticky */}
        {estadoMatriz !== null && (
          <aside className="hidden sm:flex flex-col w-52 border-l border-stone-100 bg-white px-3 py-4 space-y-3 sticky top-0 self-start max-h-screen overflow-y-auto">
            <p className="font-title text-[11px] uppercase tracking-wide text-stone-400">
              Estado emocional
            </p>
            <EmotionalMatrix
              estado={estadoMatriz}
              changedVars={changedVars}
              deltaSign={deltaSign}
            />
            {/* "Ir al informe" — always visible, enabled only after 5 minutes */}
            {phase !== "idle" && (
              <div className="pt-3 border-t border-stone-100">
                {phase === "running" ? (
                  <button
                    disabled
                    className="w-full bg-stone-100 text-stone-400 rounded-2xl py-3 px-3 text-xs font-bold font-secondary tracking-wide cursor-not-allowed"
                    title="Disponible después de 5 minutos"
                  >
                    Ver mi informe →
                  </button>
                ) : (
                  <button
                    onClick={goToReport}
                    disabled={isLoading}
                    className="w-full bg-summer-teal hover:bg-teal-400 text-white rounded-2xl py-3 px-3 text-xs font-bold font-secondary tracking-wide shadow-sm transition-all hover:scale-[1.02] disabled:opacity-40"
                  >
                    Ver mi informe →
                  </button>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}

export default function CoachSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const scenarioId = searchParams.get("scenarioId") ?? "";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { scenario, loading: scenarioLoading, error } = useScenario(scenarioId);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading || scenarioLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-warm-bg">
        <p className="text-stone-400 text-sm">Cargando escenario...</p>
      </main>
    );
  }

  if (error !== null || scenario === null || sessionId === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-warm-bg">
        <p className="text-sm text-red-500">{error ?? "Escenario no encontrado"}</p>
      </main>
    );
  }

  return <ActiveSession sessionId={sessionId} scenario={scenario} />;
}
