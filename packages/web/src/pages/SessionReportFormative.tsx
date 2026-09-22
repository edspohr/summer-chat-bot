// Coaching-shape formative report page. Reads the report from the session
// doc via useFormativeReport (which triggers generation as a fallback if
// the ClosingScreen prefetch didn't already do it).
//
// Layout order (product spec 2026-09-22):
//   1. Synthesis (mentor voice)
//   2. "Lo que funcionó"          — aciertos + whyItWorked
//   3. "Consejos para tu próxima" — oportunidades + tip (advice + ejemplo)
//   4. Matrix trajectory chart
//   5. "Tu desafío para la próxima" — nextChallenge
//   6. Optional self-reflection (Layer 3 gated via saveReflection)
//   7. Terminal buttons: retry Martina (primary), talk to Mentor
//      prefilled with mentorQuestion (secondary).
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import type {
  AciertoMoment,
  EstadoMatriz,
  FormativeReport,
  FormativeReportContent,
  OportunidadMoment,
  ReflectionSafetyMatch,
} from "@salvador/shared";
import {
  MARTINA_INITIAL_MATRIX,
  REFLECTION_MAX_CHARS,
  initialMatrixFor,
} from "@salvador/shared";
import { useAuth } from "../hooks/useAuth.js";
import { useScenario } from "../hooks/useScenario.js";
import { useSessionReportData } from "../hooks/useSessionReportData.js";
import { useFormativeReport } from "../hooks/useFormativeReport.js";
import { AppHeader } from "../components/AppHeader.js";
import { HelpButton } from "../components/HelpButton.js";
import { MatrixTrajectoryChart } from "../components/MatrixTrajectoryChart.js";
import { CrisisOverlay } from "../components/CrisisOverlay.js";
import { callSaveReflection } from "../lib/functions.js";

const PHASE_LABEL: Record<string, string> = {
  OBSERVA: "Observa",
  ACOGE: "Acoge",
  SILENCIO: "Silencio",
  ILUMINA: "Ilumina",
  SOSTEN: "Sostén",
};

export default function SessionReportFormative() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const scenarioId = searchParams.get("scenarioId") ?? "";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { scenario, loading: scenarioLoading } = useScenario(scenarioId);
  const reportData = useSessionReportData(sessionId ?? "");
  const { report, loaded } = useFormativeReport(sessionId ?? "");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading || scenarioLoading || scenario === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-warm-bg">
        <p className="text-stone-400 text-sm font-secondary">Cargando informe…</p>
      </main>
    );
  }

  const goRetry = (): void => navigate("/martina");
  const goHome = (): void => navigate("/inicio");
  const goMentorWithQuestion = (question: string): void => {
    // /mentor reads ?prompt= and prefills its composer (see MentorChat).
    navigate(`/mentor?prompt=${encodeURIComponent(question)}`);
  };

  return (
    <main className="min-h-screen bg-warm-bg">
      <AppHeader
        backLabel="Inicio"
        backTo="/inicio"
        title="Tu informe formativo"
        subtitle={`Sesión con ${scenario.persona.name.split(" ")[0]}`}
        suppressFloatingHelp
      />
      <div className="max-w-3xl mx-auto space-y-5 px-4 sm:px-6 py-6 sm:py-8">
        {(!loaded || report === null || report.status === "generating") && (
          <GeneratingCard />
        )}
        {report !== null && (report.status === "minimal" || report.status === "failed") && (
          <MinimalCard report={report} onRetry={goRetry} onHome={goHome} />
        )}
        {report !== null && report.status === "ready" && report.content !== undefined && (
          <ReadyContent
            content={report.content}
            scenarioId={scenarioId}
            estadoMatriz={reportData.estadoMatriz}
            sessionId={sessionId ?? ""}
            onRetry={goRetry}
            onMentor={goMentorWithQuestion}
          />
        )}
      </div>
      <HelpButton />
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function GeneratingCard() {
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-8 text-center space-y-3">
      <p className="font-title uppercase tracking-wide text-summer-blue text-lg">
        Preparando tu informe
      </p>
      <p className="font-secondary text-sm text-stone-600">
        El Mentor está revisando la conversación. Suele tardar unos segundos.
      </p>
      <div className="mx-auto w-8 h-8 border-2 border-summer-teal border-t-transparent rounded-full animate-spin" aria-hidden="true" />
    </section>
  );
}

function MinimalCard({
  report,
  onRetry,
  onHome,
}: {
  report: FormativeReport;
  onRetry: () => void;
  onHome: () => void;
}) {
  const reason = report.skipReason ?? null;
  const title =
    reason === "too_short"
      ? "Fue una conversación breve"
      : reason === "crisis_interrupted"
        ? "La sesión se pausó por seguridad"
        : reason === "moments_unverifiable"
          ? "Esta vez no armamos un informe completo"
          : "Informe no disponible";
  const body =
    reason === "too_short"
      ? "Con muy pocos turnos no armamos el informe completo. La próxima, intenta sostener la conversación un poco más — Martina se abre de a poco."
      : reason === "crisis_interrupted"
        ? "Esta sesión quedó en pausa por una señal de cuidado. Cuando estés listo o lista, puedes empezar una nueva."
        : "El Mentor no logró armar el informe esta vez. Intenta una conversación nueva con Martina.";
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-8 space-y-4">
      <p className="font-title uppercase tracking-wide text-stone-800 text-base">{title}</p>
      <p className="font-secondary text-sm text-stone-600 leading-relaxed">{body}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={onRetry}
          className="bg-summer-blue hover:bg-blue-400 text-white rounded-2xl px-5 py-3 text-sm font-bold font-secondary tracking-wide transition-colors shadow-sm"
        >
          Intentar de nuevo con Martina
        </button>
        <button
          onClick={onHome}
          className="bg-transparent hover:bg-stone-50 text-stone-500 rounded-2xl px-5 py-3 text-sm font-secondary tracking-wide transition-colors border border-stone-200"
        >
          Volver al inicio
        </button>
      </div>
    </section>
  );
}

function ReadyContent({
  content,
  scenarioId,
  estadoMatriz,
  sessionId,
  onRetry,
  onMentor,
}: {
  content: FormativeReportContent;
  scenarioId: string;
  estadoMatriz: EstadoMatriz | null;
  sessionId: string;
  onRetry: () => void;
  onMentor: (q: string) => void;
}) {
  const aciertos = useMemo(
    () => content.keyMoments.filter((m): m is AciertoMoment => m.kind === "acierto"),
    [content.keyMoments],
  );
  const oportunidades = useMemo(
    () => content.keyMoments.filter((m): m is OportunidadMoment => m.kind === "oportunidad"),
    [content.keyMoments],
  );
  const initialMatrix = initialMatrixFor(scenarioId) ?? MARTINA_INITIAL_MATRIX;

  return (
    <>
      {/* 1. Synthesis */}
      <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7 space-y-3">
        <p className="font-secondary text-xs uppercase tracking-wide text-summer-teal font-bold">
          El Mentor sobre tu sesión
        </p>
        <p className="font-secondary text-base text-stone-800 leading-relaxed">
          {content.synthesis}
        </p>
      </section>

      {/* 2. Aciertos */}
      {aciertos.length > 0 && (
        <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7 space-y-4">
          <h2 className="font-title uppercase tracking-wide text-stone-800 text-sm">
            Lo que funcionó
          </h2>
          <div className="space-y-4">
            {aciertos.map((m, i) => (
              <MomentCard key={i} moment={m} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Oportunidades */}
      {oportunidades.length > 0 && (
        <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7 space-y-4">
          <h2 className="font-title uppercase tracking-wide text-stone-800 text-sm">
            Consejos para tu próxima conversación
          </h2>
          <div className="space-y-4">
            {oportunidades.map((m, i) => (
              <MomentCard key={i} moment={m} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Matrix trajectory */}
      <MatrixTrajectoryChart initial={initialMatrix} final={estadoMatriz} />

      {/* 5. Next challenge */}
      <section className="bg-summer-teal/15 rounded-3xl border border-summer-teal/40 p-6 sm:p-7 space-y-3">
        <p className="font-secondary text-xs uppercase tracking-wide text-summer-teal font-bold">
          Tu desafío para la próxima
        </p>
        <p className="font-secondary text-base text-stone-800 leading-relaxed">
          {content.nextChallenge}
        </p>
      </section>

      {/* 6. Optional self-reflection */}
      <ReflectionCard
        sessionId={sessionId}
        prompts={content.reflectionPrompts}
      />

      {/* 7. Terminal buttons */}
      <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7 space-y-3">
        <button
          onClick={onRetry}
          className="w-full bg-summer-blue hover:bg-blue-400 text-white rounded-2xl px-5 py-3.5 text-sm font-bold font-secondary tracking-wide transition-colors shadow-sm"
        >
          Intentar de nuevo con Martina
        </button>
        <button
          onClick={() => onMentor(content.mentorQuestion)}
          className="w-full bg-summer-teal/20 hover:bg-summer-teal/30 text-summer-teal rounded-2xl px-5 py-3.5 text-sm font-bold font-secondary tracking-wide transition-colors"
        >
          Hablar con el Mentor sobre este desafío
        </button>
      </section>
    </>
  );
}

function MomentCard({ moment }: { moment: AciertoMoment | OportunidadMoment }) {
  const phase = moment.oasisPhase !== undefined ? PHASE_LABEL[moment.oasisPhase] : null;
  return (
    <div className="border border-stone-100 rounded-2xl p-4 sm:p-5 space-y-3 bg-stone-50/50">
      {phase !== null && (
        <p className="font-secondary text-[10px] uppercase tracking-wider text-stone-400 font-bold">
          {phase}
        </p>
      )}
      <blockquote className="border-l-4 border-summer-blue/60 pl-3 py-1 font-secondary text-sm italic text-stone-700">
        “{moment.quote}”
      </blockquote>
      {moment.martinaCue !== undefined && (
        <p className="font-secondary text-xs text-stone-500">
          Martina había dicho: <span className="italic">“{moment.martinaCue}”</span>
        </p>
      )}
      <p className="font-secondary text-sm text-stone-700 leading-relaxed">
        {moment.whatHappenedWithMartina}
      </p>
      {moment.kind === "acierto" ? (
        <p className="font-secondary text-sm text-summer-teal leading-relaxed">
          <span className="font-bold">Por qué funcionó: </span>
          {moment.whyItWorked}
        </p>
      ) : (
        <div className="space-y-2 rounded-xl bg-summer-yellow/40 p-3">
          <p className="font-secondary text-sm text-stone-800 leading-relaxed">
            {moment.tip.advice}
          </p>
          <p className="font-secondary text-xs text-stone-500">
            Ejemplo sugerido{" "}
            <span className="italic text-stone-400">(por validar clínicamente)</span>:
          </p>
          <p className="font-secondary text-sm text-stone-800 italic bg-white rounded-lg px-3 py-2 border border-summer-yellow/60">
            “{moment.tip.examplePhrase}”
          </p>
        </div>
      )}
    </div>
  );
}

function ReflectionCard({
  sessionId,
  prompts,
}: {
  sessionId: string;
  prompts: string[];
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [safetyMatch, setSafetyMatch] = useState<ReflectionSafetyMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crisisTemplateOpen, setCrisisTemplateOpen] = useState(false);

  const canSubmit = text.trim().length > 0 && !saving && !saved;

  async function submit(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const result = await callSaveReflection({ sessionId, text: text.trim() });
      setSaved(true);
      if (result.data.safetyMatch !== null) {
        setSafetyMatch(result.data.safetyMatch);
        setCrisisTemplateOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar tu reflexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7 space-y-4">
        <div className="space-y-2">
          <h2 className="font-title uppercase tracking-wide text-stone-800 text-sm">
            Autorreflexión (opcional)
          </h2>
          <p className="font-secondary text-xs text-stone-500 leading-relaxed">
            Estas preguntas son para ti. Puedes escribir un par de líneas si te sirve
            organizar la experiencia; no las lee nadie más que tú.
          </p>
        </div>
        <ul className="space-y-1.5">
          {prompts.map((p, i) => (
            <li key={i} className="font-secondary text-sm text-stone-700 leading-relaxed">
              — {p}
            </li>
          ))}
        </ul>
        {!saved && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, REFLECTION_MAX_CHARS))}
              placeholder="Escribe aquí lo que te haga sentido…"
              rows={4}
              disabled={saving}
              className="w-full resize-none rounded-2xl border border-stone-200 bg-warm-bg px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="font-secondary text-[11px] text-stone-400 tabular-nums">
                {text.length} / {REFLECTION_MAX_CHARS}
              </p>
              <button
                onClick={() => void submit()}
                disabled={!canSubmit}
                className="bg-summer-teal hover:bg-teal-400 text-white rounded-2xl px-5 py-2.5 text-sm font-bold font-secondary tracking-wide disabled:opacity-40 transition-colors shadow-sm"
              >
                {saving ? "Guardando…" : "Guardar reflexión"}
              </button>
            </div>
            {error !== null && (
              <p className="font-secondary text-xs text-summer-peach">{error}</p>
            )}
          </>
        )}
        {saved && safetyMatch === null && (
          <p className="font-secondary text-sm text-summer-teal">
            Tu reflexión quedó guardada.
          </p>
        )}
        {saved && safetyMatch !== null && (
          <p className="font-secondary text-sm text-stone-700">
            Guardamos lo que escribiste. Además, quisimos mostrarte algo importante — revísalo cuando quieras.
          </p>
        )}
      </section>

      {crisisTemplateOpen && safetyMatch !== null && (
        <CrisisOverlay
          template={
            "Lo que escribiste me importa, y no quiero pasar de largo.\n\n" +
            "Summer ChatBot es una herramienta de entrenamiento, no un servicio clínico. Si algo de lo que escribiste está pasando por ti ahora, hay líneas gratis, 24/7:\n\n" +
            "• *4141 — Línea de Prevención del Suicidio.\n" +
            "• 600 360 7777 opción 2 — Salud Responde.\n" +
            "• hablemosdetodo.injuv.gob.cl — chat anónimo (15–29 años).\n" +
            "• 131 — SAMU si estás en peligro vital ahora."
          }
          onConfirmResume={() => setCrisisTemplateOpen(false)}
          canResume={true}
        />
      )}
    </>
  );
}
