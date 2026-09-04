import { useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useScenario } from "../hooks/useScenario.js";
import { useTagProgress } from "../hooks/useTagProgress.js";
import { useSessionReportData } from "../hooks/useSessionReportData.js";
import { HelpButton } from "../components/HelpButton.js";
import { OASIS_PHASES_IN_ORDER, phaseFromTagId } from "../lib/oasisPhase.js";
import type { EstadoMatriz, OasisPhase, Scenario } from "@salvador/shared";
import { initialMatrixFor, MARTINA_INITIAL_MATRIX } from "@salvador/shared";

// User-facing Spanish (Chile). Kept in one constant so it is easy to edit
// with the clinical team ahead of production.
const CLOSING_COPY = {
  title: "Gracias por entrenar",
  body:
    "Cada conversación que practicas te prepara para acompañar mejor a un estudiante real. No hay una única forma correcta de hacerlo: lo importante es seguir intentando. Martina estará aquí cuando quieras volver a practicar.",
  reminder:
    "Recuerda que esto fue una simulación. Si tú o alguien cercano necesita apoyo ahora, llama al *4141 (Línea de Prevención del Suicidio del MINSAL).",
  primary: "Intentar de nuevo",
  secondary: "Volver al inicio",
} as const;

const PHASE_LABEL: Record<OasisPhase, string> = {
  OBSERVA: "Observa",
  ACOGE: "Acoge",
  SILENCIO: "Silencio",
  ILUMINA: "Ilumina",
  SOSTEN: "Sostén",
};

// Pastel rotation for the per-phase pills. Order matches OASIS.
const PHASE_COLORS: Record<OasisPhase, { bg: string; text: string }> = {
  OBSERVA: { bg: "bg-summer-blue/15", text: "text-summer-blue" },
  ACOGE: { bg: "bg-summer-teal/20", text: "text-summer-teal" },
  SILENCIO: { bg: "bg-summer-pink/20", text: "text-summer-pink" },
  ILUMINA: { bg: "bg-summer-yellow/60", text: "text-amber-800" },
  SOSTEN: { bg: "bg-summer-peach/30", text: "text-orange-800" },
};

export default function SessionReportMinimal() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const scenarioId = searchParams.get("scenarioId") ?? "";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { scenario, loading: scenarioLoading } = useScenario(scenarioId);
  const tagProgressItems = useTagProgress(sessionId ?? "");
  const reportData = useSessionReportData(sessionId ?? "");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading || scenarioLoading || scenario === null || reportData.loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-warm-bg">
        <p className="text-stone-400 text-sm">Generando reporte...</p>
      </main>
    );
  }

  const completedIds = new Set(tagProgressItems.filter((t) => t.completed).map((t) => t.tagId));
  const expectedIds = scenario.requiredTags.map((t) => t.tagId);
  const matchedCount = expectedIds.filter((id) => completedIds.has(id)).length;
  const totalCount = expectedIds.length;
  const achievementPct =
    totalCount === 0 ? 0 : Math.round((matchedCount / totalCount) * 100);

  const phaseBreakdown = buildPhaseBreakdown(expectedIds, completedIds);
  const minutes = computeMinutes(reportData.sesionIniciadaEnIso, reportData.endedAtIso);

  return (
    <main className="min-h-screen bg-warm-bg py-6 sm:py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <HeaderCard scenarioName={scenario.persona.name} />

        <AchievementCard pct={achievementPct} />

        <QuantitativeCard
          minutes={minutes}
          userTurns={reportData.userTurnCount}
          matched={matchedCount}
          total={totalCount}
          phaseBreakdown={phaseBreakdown}
        />

        <MatrixCard scenario={scenario} estado={reportData.estadoMatriz} />

        <ClosingCard onRetry={() => navigate("/martina")} onHome={() => navigate("/inicio")} />
      </div>

      <HelpButton />
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function HeaderCard({ scenarioName }: { scenarioName: string }) {
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7 flex items-center gap-4">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-summer-peach/20 overflow-hidden border border-stone-100 flex-shrink-0">
        <img
          src="/avatar-martina-v3.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          style={{ objectPosition: "50% 30%", transform: "scale(1.7)", transformOrigin: "50% 32%" }}
        />
      </div>
      <div className="min-w-0">
        <h1 className="font-title uppercase tracking-wide text-summer-blue text-xl sm:text-2xl">
          Sesión completada
        </h1>
        <p className="font-secondary text-sm text-stone-600 mt-1">
          Gracias por practicar con {scenarioName.split(" ")[0]}.
        </p>
      </div>
    </section>
  );
}

function AchievementCard({ pct }: { pct: number }) {
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7 text-center">
      <p className="font-secondary text-xs uppercase tracking-wide text-stone-400">
        Nivel de logro
      </p>
      <p className="font-title text-summer-blue text-6xl sm:text-7xl leading-none mt-2 tabular-nums">
        {pct}%
      </p>
      <p className="font-secondary text-xs text-stone-500 mt-3 leading-relaxed max-w-md mx-auto">
        Porcentaje de conductas OASIS observadas durante la conversación.
      </p>
    </section>
  );
}

function QuantitativeCard({
  minutes,
  userTurns,
  matched,
  total,
  phaseBreakdown,
}: {
  minutes: string;
  userTurns: number;
  matched: number;
  total: number;
  phaseBreakdown: ReadonlyArray<{ phase: OasisPhase; matched: number; total: number }>;
}) {
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile label="Minutos de conversación" value={minutes} />
        <MetricTile label="Turnos" value={String(userTurns)} />
        <MetricTile label="Conductas OASIS logradas" value={`${matched} de ${total}`} />
        <MetricTile label="Fases con evidencia" value={String(phasesWithEvidence(phaseBreakdown))} />
      </div>

      <ul className="flex flex-wrap gap-2 pt-1">
        {phaseBreakdown.map(({ phase, matched: m, total: t }) => {
          const empty = t === 0;
          const colors = PHASE_COLORS[phase];
          const className = empty
            ? "bg-stone-100 text-stone-400"
            : `${colors.bg} ${colors.text}`;
          return (
            <li key={phase}>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-secondary text-xs font-semibold ${className}`}
              >
                {PHASE_LABEL[phase]}
                <span className="font-mono font-bold tabular-nums">
                  {empty ? "—" : `${m}/${t}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-warm-bg rounded-2xl border border-stone-100 px-3 py-3 text-center">
      <p className="font-title text-summer-blue text-2xl sm:text-3xl leading-tight tabular-nums">
        {value}
      </p>
      <p className="font-secondary text-[11px] uppercase tracking-wide text-stone-500 mt-1 leading-tight">
        {label}
      </p>
    </div>
  );
}

interface MatrixRow {
  label: string;
  initial: number | null;
  final: number;
  color: string;
  track: string;
}

function MatrixCard({ scenario, estado }: { scenario: Scenario; estado: EstadoMatriz | null }) {
  if (estado === null) {
    return (
      <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7">
        <h2 className="font-title uppercase tracking-wide text-summer-blue text-base sm:text-lg">
          Cómo terminó Martina
        </h2>
        <p className="font-secondary text-xs text-stone-500 mt-2 leading-relaxed">
          No hay estado emocional registrado para esta sesión (puede ocurrir en modo prompt puro
          o si la conversación terminó antes del primer turno).
        </p>
      </section>
    );
  }

  // Read initial values from the same canonical source the engine falls back
  // to (@salvador/shared → initialMatrixFor). Do NOT read from
  // scenario.emotionalStateVariables — that field is decorative and can drift
  // (see docs/debt/0022). Fallback to Martina's map if scenario is unknown.
  const initial = initialMatrixFor(scenario.id) ?? MARTINA_INITIAL_MATRIX;
  const rows: MatrixRow[] = [
    {
      label: "Intensidad emocional",
      initial: initial.intensidadEmocional,
      final: estado.intensidadEmocional,
      color: "bg-summer-peach",
      track: "bg-summer-peach/20",
    },
    {
      label: "Apertura",
      initial: initial.apertura,
      final: estado.apertura,
      color: "bg-summer-teal",
      track: "bg-summer-teal/20",
    },
    {
      label: "Confianza en la ayuda",
      initial: initial.confianzaEnLaAyuda,
      final: estado.confianzaEnLaAyuda,
      color: "bg-summer-blue",
      track: "bg-summer-blue/20",
    },
  ];

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-7 space-y-4">
      <h2 className="font-title uppercase tracking-wide text-summer-blue text-base sm:text-lg">
        Cómo terminó Martina
      </h2>
      <div className="space-y-4">
        {rows.map((r) => (
          <MatrixRowView key={r.label} row={r} />
        ))}
      </div>
      <p className="font-secondary text-xs text-stone-500 leading-relaxed">
        Estado emocional del personaje al cierre de la sesión, según el evaluador.
      </p>
    </section>
  );
}

function MatrixRowView({ row }: { row: MatrixRow }) {
  const pct = Math.round((row.final / 10) * 100);
  const delta = row.initial === null ? null : row.final - row.initial;
  const deltaLabel =
    delta === null ? null : delta > 0 ? `+${delta}` : delta === 0 ? "±0" : `${delta}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-secondary text-sm font-semibold text-stone-700">{row.label}</span>
        <span className="font-mono text-xs text-stone-600 tabular-nums">
          {row.initial === null ? (
            <>{row.final}<span className="text-stone-400">/10</span></>
          ) : (
            <>
              {row.initial}
              <span className="text-stone-400 mx-1">→</span>
              <span className="font-bold text-stone-800">{row.final}</span>
              <span className="text-stone-400">/10</span>
              {deltaLabel !== null && (
                <span
                  className={`ml-2 font-bold ${
                    delta === null || delta === 0
                      ? "text-stone-400"
                      : (delta ?? 0) > 0
                      ? "text-emerald-600"
                      : "text-rose-500"
                  }`}
                >
                  {deltaLabel}
                </span>
              )}
            </>
          )}
        </span>
      </div>
      <div className={`h-2.5 w-full rounded-full ${row.track}`}>
        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ClosingCard({ onRetry, onHome }: { onRetry: () => void; onHome: () => void }) {
  return (
    <section className="bg-summer-teal/20 rounded-3xl shadow-sm border border-summer-teal/30 p-6 sm:p-7 space-y-4">
      <h2 className="font-title uppercase tracking-wide text-summer-blue text-lg">
        {CLOSING_COPY.title}
      </h2>
      <p className="font-secondary text-sm text-stone-700 leading-relaxed">{CLOSING_COPY.body}</p>
      <p className="font-secondary text-xs text-stone-600 leading-relaxed bg-white/60 rounded-2xl px-4 py-3">
        {CLOSING_COPY.reminder}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button
          onClick={onRetry}
          className="flex-1 bg-summer-blue text-white rounded-full py-3 font-secondary font-semibold text-sm shadow-sm hover:scale-[1.02] transition-all"
        >
          {CLOSING_COPY.primary}
        </button>
        <button
          onClick={onHome}
          className="flex-1 bg-white text-stone-700 rounded-full py-3 font-secondary font-semibold text-sm shadow-sm hover:scale-[1.02] transition-all border border-stone-100"
        >
          {CLOSING_COPY.secondary}
        </button>
      </div>
    </section>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildPhaseBreakdown(
  expectedIds: readonly string[],
  completedIds: ReadonlySet<string>,
): ReadonlyArray<{ phase: OasisPhase; matched: number; total: number }> {
  const totals = new Map<OasisPhase, number>();
  const matched = new Map<OasisPhase, number>();
  for (const phase of OASIS_PHASES_IN_ORDER) {
    totals.set(phase, 0);
    matched.set(phase, 0);
  }
  for (const id of expectedIds) {
    const phase = phaseFromTagId(id);
    if (phase === null) continue;
    totals.set(phase, (totals.get(phase) ?? 0) + 1);
    if (completedIds.has(id)) matched.set(phase, (matched.get(phase) ?? 0) + 1);
  }
  return OASIS_PHASES_IN_ORDER.map((phase) => ({
    phase,
    matched: matched.get(phase) ?? 0,
    total: totals.get(phase) ?? 0,
  }));
}

function phasesWithEvidence(
  breakdown: ReadonlyArray<{ matched: number; total: number }>,
): number {
  return breakdown.filter((b) => b.matched > 0).length;
}

function computeMinutes(startIso: string | null, endIso: string | null): string {
  if (startIso === null || endIso === null) return "—";
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return "—";
  const seconds = Math.floor((endMs - startMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "<1";
  return String(minutes);
}
