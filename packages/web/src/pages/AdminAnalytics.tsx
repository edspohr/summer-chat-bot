// Analytics dashboard (Phase 6 + 7, v2 rework 2026-11).
// Reads pre-computed rollups from analytics_rollups/{YYYY-MM-DD}.
//
// PROTECTION MODEL — provisional. There is no user-facing gate; obscurity is
// the only protection ("/admin/analytics" is not linked from any participant
// page). Firestore rules require authentication to read the rollups, so a
// signed-in user (including anonymous /martina users) can view them. The data
// is aggregated and non-personal by design, so exposure is bounded to totals.
// Tighten to role=admin when we're ready.
//
// Two views, both fed by a single read of the whole analytics_rollups
// collection (one small doc per day — ~200 docs today):
//   - "periodo" : 7 / 30 / 90 days or everything, with scenario / channel /
//                 mode / cohort filters. Coach (Martina) and Mentor sessions
//                 are always counted apart.
//   - "dia"     : single-day snapshot, one card per rollup group.
//
// Rollups are written at 04:00 Santiago for the previous day, so every window
// ends YESTERDAY. Days inside the window with no rollup doc are surfaced as
// "missing" (scheduler failure), never silently drawn as zero.
//
// Rollup schema v1 docs (pre-2026-11) lack source/modo/funnel/active and
// compute matrix rate over all sessions. They still render; the freshness
// banner tells the reader to run the backfill.

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import type { RollupDocument, RollupGroup } from "@salvador/shared";
import { useAuth } from "../hooks/useAuth.js";
import { signInAnon } from "../lib/auth.js";
import { db } from "../firebase.js";
import { IndicatorCard } from "../components/IndicatorCard.js";
import { INDICATOR_COPY } from "../lib/indicatorCopy.js";

// ── Constants & labels ─────────────────────────────────────────────────────

const ALL = "__all";
const NONE = "__none";
const MENTOR_SCENARIO_ID = "mentor";

type Period = 7 | 30 | 90 | "all";
const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: "all", label: "Todo" },
];

const SCENARIO_LABELS: Record<string, string> = {
  scenario_01_camila: "Camila",
  scenario_03_martina: "Martina",
  scenario_02_matias: "Matías",
  mentor: "Mentor",
};
const SOURCE_LABELS: Record<string, string> = { "8dot8": "Evento 8.8" };
const MODO_LABELS: Record<string, string> = {
  escenario: "Escenario",
  promptPuro: "Prompt puro",
};

function labelOf(map: Record<string, string>, key: string | null | undefined, noneLabel: string): string {
  if (key === null || key === undefined || key === NONE) return noneLabel;
  return map[key] ?? key;
}
const scenarioLabel = (k: string | null | undefined) => labelOf(SCENARIO_LABELS, k, "Sin escenario");
const sourceLabel = (k: string | null | undefined) => labelOf(SOURCE_LABELS, k, "Directo");
const modoLabel = (k: string | null | undefined) => labelOf(MODO_LABELS, k, "—");

// Chart colors. Hex values mirror tailwind.config tokens so SVG fills and the
// legend swatches (Tailwind classes) stay identical.
const END_STATES = [
  { key: "userEnded", label: "Cerradas por el participante", hex: "#8DD4DA", swatch: "bg-summer-teal" },
  { key: "inactivity", label: "Inactividad", hex: "#FDE49C", swatch: "bg-summer-yellow" },
  { key: "crisis", label: "Crisis", hex: "#F4C4DC", swatch: "bg-summer-pink" },
  { key: "open", label: "Sin cerrar", hex: "#d6d3d1", swatch: "bg-stone-300" },
] as const;
type EndKey = (typeof END_STATES)[number]["key"];

// ── Formatting ─────────────────────────────────────────────────────────────

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (m === 0) return `${sec}s`;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

function formatRate(num: number, den: number): string {
  if (den === 0) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

function formatDateLong(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateShort(dateStr: string): string {
  return `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
}

// ── Santiago calendar helpers ──────────────────────────────────────────────

function todayInSantiago(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

// Calendar arithmetic on YYYY-MM-DD strings. Anchoring at UTC noon keeps the
// result independent of DST and of the browser's own timezone.
function shiftDate(dateStr: string, days: number): string {
  const t = new Date(`${dateStr}T12:00:00Z`).getTime() + days * 24 * 3600_000;
  return new Date(t).toISOString().slice(0, 10);
}

function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = shiftDate(d, 1)) out.push(d);
  return out;
}

// ── Aggregation ────────────────────────────────────────────────────────────

interface Filters {
  scenario: string;
  source: string;
  modo: string;
  cohort: string;
}

const NO_FILTERS: Filters = { scenario: ALL, source: ALL, modo: ALL, cohort: ALL };

function dimMatches(filter: string, value: string | null | undefined): boolean {
  return filter === ALL || (value ?? NONE) === filter;
}

function isMentor(g: RollupGroup): boolean {
  return g.scenarioId === MENTOR_SCENARIO_ID;
}

function coachMatches(f: Filters, g: RollupGroup): boolean {
  return (
    !isMentor(g) &&
    dimMatches(f.scenario, g.scenarioId) &&
    dimMatches(f.source, g.source) &&
    dimMatches(f.modo, g.modo) &&
    dimMatches(f.cohort, g.cohortCode)
  );
}

// Mentor ignores scenario/modo filters — it has neither.
function mentorMatches(f: Filters, g: RollupGroup): boolean {
  return isMentor(g) && dimMatches(f.source, g.source) && dimMatches(f.cohort, g.cohortCode);
}

interface WeightedPair {
  value: number;
  weight: number;
}

function weightedAvg(pairs: WeightedPair[]): number {
  let sumWV = 0;
  let sumW = 0;
  for (const p of pairs) {
    if (p.weight <= 0) continue;
    sumWV += p.value * p.weight;
    sumW += p.weight;
  }
  return sumW === 0 ? 0 : sumWV / sumW;
}

interface Totals {
  sessions: number;
  firstTurn: number;
  threeTurns: number;
  fiveMin: number;
  reportReady: number;
  reflection: number;
  userEnded: number;
  inactivity: number;
  crisis: number;
  open: number;
  abandoned: number;
  dwellCount: number;
  under5: number;
  fiveTo10: number;
  over10: number;
  dwellFallback: number;
  dwellNoStart: number;
  dwellMedianPairs: WeightedPair[];
  dwellP25Pairs: WeightedPair[];
  dwellP75Pairs: WeightedPair[];
  turnsMedianPairs: WeightedPair[];
  tagsMedianPairs: WeightedPair[];
  matrixMoved: number;
  matrixEligible: number;
  safetySessions: number;
  safetyActivations: number;
  crisisExercise: number;
  crisisReal: number;
  crisisUnbranched: number;
  nudges: number;
  repliesAfterNudge: number;
  devices: number;
}

function emptyTotals(): Totals {
  return {
    sessions: 0,
    firstTurn: 0,
    threeTurns: 0,
    fiveMin: 0,
    reportReady: 0,
    reflection: 0,
    userEnded: 0,
    inactivity: 0,
    crisis: 0,
    open: 0,
    abandoned: 0,
    dwellCount: 0,
    under5: 0,
    fiveTo10: 0,
    over10: 0,
    dwellFallback: 0,
    dwellNoStart: 0,
    dwellMedianPairs: [],
    dwellP25Pairs: [],
    dwellP75Pairs: [],
    turnsMedianPairs: [],
    tagsMedianPairs: [],
    matrixMoved: 0,
    matrixEligible: 0,
    safetySessions: 0,
    safetyActivations: 0,
    crisisExercise: 0,
    crisisReal: 0,
    crisisUnbranched: 0,
    nudges: 0,
    repliesAfterNudge: 0,
    devices: 0,
  };
}

function addGroup(t: Totals, g: RollupGroup): void {
  t.sessions += g.sessionsStarted;
  // v1 docs have no funnel: fall back to the closest available signal.
  t.firstTurn += g.funnel?.started ?? g.sessionsStarted - (g.dwell.noStartCount ?? 0);
  t.threeTurns += g.funnel?.threeTurnsPlus ?? 0;
  t.fiveMin += g.sessionsComplete ?? 0;
  t.reportReady += g.funnel?.reportReady ?? 0;
  t.reflection += g.funnel?.reflectionSubmitted ?? 0;

  t.userEnded += g.ended.closed_completed + g.ended.completed_legacy;
  t.inactivity += g.ended.closed_inactivity;
  t.crisis += g.ended.crisis_interrupted;
  t.abandoned += g.ended.abandoned;
  t.open +=
    g.ended.active ??
    Math.max(
      0,
      g.sessionsStarted -
        g.ended.closed_completed -
        g.ended.completed_legacy -
        g.ended.closed_inactivity -
        g.ended.crisis_interrupted -
        g.ended.abandoned,
    );

  if (g.dwell.count > 0) {
    t.dwellCount += g.dwell.count;
    t.under5 += g.dwell.under5Min;
    t.fiveTo10 += g.dwell.fiveToTenMin;
    t.over10 += g.dwell.overTenMin;
    t.dwellMedianPairs.push({ value: g.dwell.medianSeconds, weight: g.dwell.count });
    t.dwellP25Pairs.push({ value: g.dwell.p25Seconds, weight: g.dwell.count });
    t.dwellP75Pairs.push({ value: g.dwell.p75Seconds, weight: g.dwell.count });
  }
  t.dwellFallback += g.dwell.fallbackCount ?? 0;
  t.dwellNoStart += g.dwell.noStartCount ?? 0;
  if (g.turns.count > 0) t.turnsMedianPairs.push({ value: g.turns.medianTurns, weight: g.turns.count });
  t.tagsMedianPairs.push({ value: g.tagsPerSessionMedian, weight: g.sessionsStarted });

  t.matrixMoved += g.matrixMovedSessions;
  t.matrixEligible += g.matrixEligibleSessions ?? g.sessionsStarted;

  t.safetySessions += g.crisis.sessionsWithActivation ?? 0;
  t.safetyActivations += g.crisis.safeguardActivations;
  t.crisisExercise += g.crisis.crisisExercise;
  t.crisisReal += g.crisis.crisisFlaggedReal;
  t.crisisUnbranched += g.crisis.crisisUnbranched;

  t.nudges += g.nudgesSent;
  t.repliesAfterNudge += g.repliesAfterNudge;
  t.devices += g.uniqueDevices;
}

interface DailyPoint {
  date: string;
  status: "ok" | "missing";
  values: Record<EndKey, number>;
}

interface PeriodAggregate {
  coach: Totals;
  mentorSessions: number;
  daily: DailyPoint[];
  activeDays: number;
  devicesAvgPerActiveDay: number;
  missingDates: string[];
  v1Days: number;
}

function aggregatePeriod(
  rollups: Map<string, RollupDocument>,
  dates: string[],
  filters: Filters,
): PeriodAggregate {
  const coach = emptyTotals();
  let mentorSessions = 0;
  let activeDays = 0;
  let devicesOnActiveDays = 0;
  let v1Days = 0;
  const missingDates: string[] = [];
  const daily: DailyPoint[] = [];

  for (const date of dates) {
    const rollup = rollups.get(date);
    if (rollup === undefined) {
      missingDates.push(date);
      daily.push({ date, status: "missing", values: { userEnded: 0, inactivity: 0, crisis: 0, open: 0 } });
      continue;
    }
    if (rollup.schemaVersion !== 2) v1Days++;

    const day = emptyTotals();
    for (const g of rollup.groups) {
      if (mentorMatches(filters, g)) mentorSessions += g.sessionsStarted;
      if (coachMatches(filters, g)) addGroup(day, g);
    }
    if (day.sessions > 0) {
      activeDays++;
      devicesOnActiveDays += day.devices;
    }
    daily.push({
      date,
      status: "ok",
      values: {
        userEnded: day.userEnded,
        inactivity: day.inactivity,
        crisis: day.crisis,
        // "abandoned" is never written by the backend today; fold it into
        // "sin cerrar" so the chart stays four series.
        open: day.open + day.abandoned,
      },
    });
    for (const g of rollup.groups) {
      if (coachMatches(filters, g)) addGroup(coach, g);
    }
  }

  return {
    coach,
    mentorSessions,
    daily,
    activeDays,
    devicesAvgPerActiveDay: activeDays === 0 ? 0 : Math.round((devicesOnActiveDays / activeDays) * 10) / 10,
    missingDates,
    v1Days,
  };
}

// Distinct values for each filter dimension across every loaded rollup.
interface FilterOptions {
  scenarios: string[];
  sources: string[];
  modos: string[];
  cohorts: string[];
}

function collectFilterOptions(rollups: Map<string, RollupDocument>): FilterOptions {
  const scenarios = new Set<string>();
  const sources = new Set<string>();
  const modos = new Set<string>();
  const cohorts = new Set<string>();
  for (const r of rollups.values()) {
    for (const g of r.groups) {
      if (isMentor(g)) continue;
      scenarios.add(g.scenarioId);
      sources.add(g.source ?? NONE);
      if (g.modo !== undefined) modos.add(g.modo ?? NONE);
      cohorts.add(g.cohortCode ?? NONE);
    }
  }
  return {
    scenarios: [...scenarios].sort(),
    sources: [...sources].sort(),
    modos: [...modos].sort(),
    cohorts: [...cohorts].sort(),
  };
}

// ── Shared UI bits ─────────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-4">
      <header>
        <h3 className="font-title uppercase tracking-wide text-stone-800 text-sm">{title}</h3>
        {subtitle !== undefined && (
          <p className="font-secondary text-[11px] text-stone-500 mt-0.5">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-warm-bg px-3 py-2">
      <p className="font-secondary text-stone-500 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="font-secondary text-stone-800 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-stone-200 bg-warm-bg p-0.5 text-xs font-secondary"
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md transition ${
            o.value === value
              ? "bg-white text-stone-800 shadow-sm font-bold"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  format,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
  format: (v: string) => string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-secondary text-stone-500 min-w-0">
      <span className="uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-stone-200 bg-warm-bg px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-summer-blue/50"
      >
        <option value={ALL}>{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

// Horizontal stacked bar showing permanencia buckets.
function DwellBar({ under5, fiveTo10, over10 }: { under5: number; fiveTo10: number; over10: number }) {
  const total = under5 + fiveTo10 + over10;
  if (total === 0) {
    return <p className="text-stone-400 text-xs italic">Sin sesiones con permanencia registrada.</p>;
  }
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded-full overflow-hidden bg-stone-100">
        <div className="bg-summer-peach" style={{ width: `${pct(under5)}%` }} title={`Menos de 5 min: ${under5}`} />
        <div className="bg-summer-yellow" style={{ width: `${pct(fiveTo10)}%` }} title={`5 a 10 min: ${fiveTo10}`} />
        <div className="bg-summer-teal" style={{ width: `${pct(over10)}%` }} title={`Más de 10 min: ${over10}`} />
      </div>
      <div className="flex justify-between text-[10px] font-secondary text-stone-500 tabular-nums">
        <span>&lt;5 min: {under5}</span>
        <span>5–10 min: {fiveTo10}</span>
        <span>&gt;10 min: {over10}</span>
      </div>
    </div>
  );
}

// ── Period view — freshness banner ─────────────────────────────────────────

function FreshnessBanner({
  rollups,
  yesterday,
  agg,
}: {
  rollups: Map<string, RollupDocument>;
  yesterday: string;
  agg: PeriodAggregate;
}) {
  let latestDate: string | null = null;
  for (const d of rollups.keys()) if (latestDate === null || d > latestDate) latestDate = d;
  const latest = latestDate !== null ? rollups.get(latestDate) : undefined;
  const stale = latestDate === null || latestDate < yesterday;

  return (
    <div className="space-y-2">
      <div className="bg-white/70 rounded-xl border border-stone-100 px-4 py-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[11px] font-secondary text-stone-500">
        <span>
          Datos hasta{" "}
          <span className="text-stone-700 font-bold">
            {latestDate !== null ? formatDateLong(latestDate) : "—"}
          </span>
          {latest !== undefined && (
            <> · calculados {new Date(latest.generatedAtIso).toLocaleString("es-CL")}</>
          )}
        </span>
        <span>Se recalcula cada día a las 04:00 (Santiago). El día de hoy aparece mañana.</span>
      </div>

      {stale && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-900 font-secondary">
          El cálculo de ayer ({formatDateLong(yesterday)}) no está disponible. Revisa los logs de{" "}
          <code className="font-mono">analyticsRollupDaily</code>.
        </div>
      )}

      {agg.missingDates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-900 font-secondary space-y-1">
          <p>
            {agg.missingDates.length === 1 ? "Falta 1 día" : `Faltan ${agg.missingDates.length} días`} en el
            período ({agg.missingDates.slice(0, 5).map(formatDateShort).join(", ")}
            {agg.missingDates.length > 5 ? "…" : ""}). Se marcan en el gráfico y no cuentan como cero.
          </p>
          <code className="block font-mono text-[11px] text-amber-800">
            pnpm --filter @salvador/functions backfill:analytics -- {agg.missingDates[0]}{" "}
            {agg.missingDates[agg.missingDates.length - 1]}
          </code>
        </div>
      )}

      {agg.v1Days > 0 && (
        <div className="bg-stone-100 rounded-xl px-4 py-2 text-xs text-stone-600 font-secondary">
          {agg.v1Days} días usan el formato de cálculo anterior: canal, modo, embudo y sesiones con
          activación de seguridad pueden aparecer incompletos hasta correr el backfill.
        </div>
      )}
    </div>
  );
}

// ── Period view — stacked bar chart (SVG, no dep) ──────────────────────────

function StackedBarChart({ daily }: { daily: DailyPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 900;
  const height = 220;
  const padLeft = 32;
  const padRight = 8;
  const padTop = 12;
  const padBottom = 28;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const totalOf = (d: DailyPoint) => END_STATES.reduce((s, e) => s + d.values[e.key], 0);
  const maxTotal = daily.reduce((m, d) => Math.max(m, totalOf(d)), 0);
  // Round the axis max up to a "nice" number so gridlines land on integers.
  const axisMax = maxTotal <= 4 ? 4 : Math.ceil(maxTotal / 4) * 4;
  const barW = chartW / Math.max(1, daily.length);
  const gap = barW > 6 ? 1 : 0;

  const yFor = (v: number) => padTop + chartH - (v / axisMax) * chartH;
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(axisMax * f));
  const labelEvery = Math.max(1, Math.ceil(daily.length / 8));

  const hovered: DailyPoint | null = hoverIdx !== null ? daily[hoverIdx] ?? null : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Sesiones con Martina por día, apiladas según cómo terminaron"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {gridValues.map((v) => (
            <g key={v}>
              <line x1={padLeft} x2={width - padRight} y1={yFor(v)} y2={yFor(v)} stroke="#e7e5e4" strokeWidth={1} />
              <text x={padLeft - 6} y={yFor(v) + 3} textAnchor="end" className="fill-stone-400" fontSize={10}>
                {v}
              </text>
            </g>
          ))}

          {daily.map((d, i) => {
            const x = padLeft + i * barW;
            const w = Math.max(1, barW - gap);
            let cursorY = padTop + chartH;
            return (
              <g
                key={d.date}
                onMouseEnter={() => setHoverIdx(i)}
                onClick={() => setHoverIdx((cur) => (cur === i ? null : i))}
              >
                <rect
                  x={x}
                  y={padTop}
                  width={w}
                  height={chartH}
                  fill={hoverIdx === i ? "#f5f5f4" : "transparent"}
                />
                {d.status === "missing" ? (
                  // Missing rollup: a short red tick under the baseline.
                  <rect x={x} y={padTop + chartH + 2} width={w} height={4} fill="#f87171" />
                ) : (
                  END_STATES.map((s) => {
                    const v = d.values[s.key];
                    if (v === 0) return null;
                    const h = (v / axisMax) * chartH;
                    cursorY -= h;
                    return <rect key={s.key} x={x} y={cursorY} width={w} height={h} fill={s.hex} />;
                  })
                )}
              </g>
            );
          })}

          {daily.map((d, i) => {
            const isLast = i === daily.length - 1;
            if (!(i % labelEvery === 0 || isLast)) return null;
            // Avoid the last label colliding with the previous regular one.
            if (isLast && i % labelEvery !== 0 && i % labelEvery < labelEvery / 2) return null;
            return (
              <text
                key={`x-${d.date}`}
                x={padLeft + i * barW + barW / 2}
                y={height - padBottom + 18}
                textAnchor="middle"
                className="fill-stone-400"
                fontSize={10}
              >
                {formatDateShort(d.date)}
              </text>
            );
          })}
        </svg>

        {hovered !== null && (
          <div className="absolute top-1 right-1 bg-white border border-stone-200 rounded-lg px-3 py-2 shadow-sm text-[11px] font-secondary text-stone-700 min-w-[180px] pointer-events-none">
            <p className="font-bold text-stone-800 mb-1">{formatDateLong(hovered.date)}</p>
            {hovered.status === "missing" ? (
              <p className="text-red-700">Sin cálculo para este día</p>
            ) : (
              <>
                <p>
                  Total: <span className="tabular-nums font-bold">{totalOf(hovered)}</span>
                </p>
                {END_STATES.map((s) => (
                  <p key={s.key} className="flex items-center gap-1">
                    <span className={`inline-block w-2 h-2 rounded-sm ${s.swatch}`} />
                    {s.label}: <span className="tabular-nums ml-auto pl-2">{hovered.values[s.key]}</span>
                  </p>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-secondary text-stone-600">
        {END_STATES.map((s) => (
          <LegendItem key={s.key} swatch={s.swatch} label={s.label} />
        ))}
        {daily.some((d) => d.status === "missing") && <LegendItem swatch="bg-red-400" label="Día sin cálculo" />}
      </div>
    </div>
  );
}

// ── Period view — funnel ───────────────────────────────────────────────────

function FunnelPanel({ t }: { t: Totals }) {
  const steps = [
    { label: "Abrieron la sesión", value: t.sessions },
    { label: "Escribieron al menos un turno", value: t.firstTurn },
    { label: "Llegaron a 3 turnos", value: t.threeTurns },
    { label: "Llegaron a 5 minutos", value: t.fiveMin },
    { label: "Recibieron informe formativo", value: t.reportReady },
    { label: "Escribieron su reflexión", value: t.reflection },
  ];
  const max = Math.max(1, t.sessions);
  return (
    <Panel
      title="Recorrido del participante"
      subtitle="Cuántas sesiones alcanzaron cada hito. Cada barra es independiente: una sesión puede recibir informe sin llegar a 5 minutos."
    >
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[14rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="font-secondary text-xs text-stone-600 truncate">{s.label}</span>
            <span className="font-secondary text-xs text-stone-800 font-bold tabular-nums text-right sm:order-last">
              {s.value}
              <span className="text-stone-400 font-normal ml-1">{formatRate(s.value, t.sessions)}</span>
            </span>
            <div className="col-span-2 sm:col-span-1 h-3 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full bg-summer-blue rounded-full" style={{ width: `${(s.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ── Period view — page section ─────────────────────────────────────────────

function PeriodView({ rollups, yesterday }: { rollups: Map<string, RollupDocument>; yesterday: string }) {
  const [period, setPeriod] = useState<Period>(30);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const options = useMemo(() => collectFilterOptions(rollups), [rollups]);

  const dates = useMemo(() => {
    if (period === "all") {
      const first = [...rollups.keys()].sort()[0] ?? yesterday;
      return datesBetween(first, yesterday);
    }
    return datesBetween(shiftDate(yesterday, -(period - 1)), yesterday);
  }, [period, rollups, yesterday]);

  const agg = useMemo(() => aggregatePeriod(rollups, dates, filters), [rollups, dates, filters]);
  const t = agg.coach;

  const setFilter = (k: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const filtersActive = Object.values(filters).some((v) => v !== ALL);
  // A filter with a single option filters nothing — hide it. (v1 docs carry
  // no modo; cohort codes are unused outside test traffic so far.)
  const visibleFilters = (
    [
      { key: "scenario", label: "Escenario", options: options.scenarios, allLabel: "Todos", format: scenarioLabel },
      { key: "source", label: "Canal de entrada", options: options.sources, allLabel: "Todos", format: sourceLabel },
      { key: "modo", label: "Modo", options: options.modos, allLabel: "Todos", format: modoLabel },
      {
        key: "cohort",
        label: "Cohorte",
        options: options.cohorts,
        allLabel: "Todas",
        format: (c: string) => (c === NONE ? "Sin cohorte" : c),
      },
    ] satisfies Array<{
      key: keyof Filters;
      label: string;
      options: string[];
      allLabel: string;
      format: (v: string) => string;
    }>
  ).filter((f) => f.options.length > 1);
  const dwellMedian = Math.round(weightedAvg(t.dwellMedianPairs));
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  return (
    <div className="space-y-5">
      <FreshnessBanner rollups={rollups} yesterday={yesterday} agg={agg} />

      {/* Period + filters */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented ariaLabel="Período" options={PERIODS} value={period} onChange={setPeriod} />
          <p className="font-secondary text-[11px] text-stone-500">
            {firstDate !== undefined && lastDate !== undefined && (
              <>
                {formatDateLong(firstDate)} – {formatDateLong(lastDate)} ·{" "}
              </>
            )}
            {agg.activeDays} de {dates.length} días con sesiones
          </p>
        </div>
        {visibleFilters.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {visibleFilters.map((f) => (
              <FilterSelect
                key={f.key}
                label={f.label}
                value={filters[f.key]}
                onChange={setFilter(f.key)}
                options={f.options}
                allLabel={f.allLabel}
                format={f.format}
              />
            ))}
          </div>
        )}
        {filtersActive && (
          <button
            type="button"
            onClick={() => setFilters(NO_FILTERS)}
            className="font-secondary text-xs text-summer-blue hover:underline"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <IndicatorCard
          title={INDICATOR_COPY.coachSessions.title}
          value={t.sessions.toString()}
          subtitle={INDICATOR_COPY.coachSessions.subtitle}
          note={`${agg.mentorSessions} con el Mentor, contadas aparte`}
        />
        <IndicatorCard
          title={INDICATOR_COPY.reachedFiveMin.title}
          value={formatRate(t.fiveMin, t.firstTurn)}
          subtitle={INDICATOR_COPY.reachedFiveMin.subtitle}
          n={t.firstTurn}
          note={`${t.fiveMin} sesiones`}
        />
        <IndicatorCard
          title={INDICATOR_COPY.dwellMedian.title}
          value={t.dwellCount > 0 ? formatSeconds(dwellMedian) : "—"}
          subtitle={INDICATOR_COPY.dwellMedian.subtitle}
          n={t.dwellCount}
          note={agg.activeDays > 1 ? "aprox. en períodos de varios días" : undefined}
        />
        <IndicatorCard
          title={INDICATOR_COPY.reportsReady.title}
          value={formatRate(t.reportReady, t.threeTurns)}
          subtitle={INDICATOR_COPY.reportsReady.subtitle}
          n={t.threeTurns}
          note={`${t.reportReady} informes`}
        />
        <IndicatorCard
          title={INDICATOR_COPY.userEndedRate.title}
          value={formatRate(t.userEnded, t.firstTurn)}
          subtitle={INDICATOR_COPY.userEndedRate.subtitle}
          n={t.firstTurn}
        />
        <IndicatorCard
          title={INDICATOR_COPY.crisisSessions.title}
          value={t.crisis.toString()}
          subtitle={INDICATOR_COPY.crisisSessions.subtitle}
          n={t.sessions}
          note={t.sessions > 0 ? `${formatRate(t.crisis, t.sessions)} de las sesiones` : undefined}
        />
      </div>

      <Panel
        title="Sesiones por día"
        subtitle="Sesiones con Martina, apiladas según cómo terminaron. Toca o pasa el cursor sobre una barra para ver el detalle."
      >
        {t.sessions === 0 && agg.missingDates.length === 0 ? (
          <p className="text-stone-400 text-sm italic py-6">Sin sesiones en el período seleccionado.</p>
        ) : (
          <StackedBarChart daily={agg.daily} />
        )}
      </Panel>

      <FunnelPanel t={t} />

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Permanencia" subtitle={`${t.dwellCount} sesiones con duración registrada`}>
          {t.dwellCount === 0 ? (
            <p className="text-stone-400 text-sm italic">Sin datos de duración.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Metric label="Mediana*" value={formatSeconds(dwellMedian)} />
                <Metric label="p25*" value={formatSeconds(Math.round(weightedAvg(t.dwellP25Pairs)))} />
                <Metric label="p75*" value={formatSeconds(Math.round(weightedAvg(t.dwellP75Pairs)))} />
              </div>
              <DwellBar under5={t.under5} fiveTo10={t.fiveTo10} over10={t.over10} />
              <p className="text-[10px] font-secondary text-stone-400 italic">
                * Con más de un día, las medianas son aproximadas (promedio ponderado de las medianas
                diarias). Los conteos por rango sí son exactos.
                {(t.dwellFallback > 0 || t.dwellNoStart > 0) &&
                  ` ${t.dwellFallback} sesiones con fuente aproximada · ${t.dwellNoStart} sin inicio registrado.`}
              </p>
            </>
          )}
        </Panel>

        <Panel title="Práctica OASIS" subtitle="Qué tanto se movió la conversación con Martina">
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Turnos (mediana)"
              value={t.turnsMedianPairs.length > 0 ? Math.round(weightedAvg(t.turnsMedianPairs)).toString() : "—"}
            />
            <Metric
              label="Conductas OASIS (mediana)"
              value={t.sessions > 0 ? Math.round(weightedAvg(t.tagsMedianPairs)).toString() : "—"}
            />
            <Metric label="Matriz se movió" value={formatRate(t.matrixMoved, t.matrixEligible)} />
            <Metric label="Dispositivos/día" value={agg.devicesAvgPerActiveDay.toString()} />
          </div>
          <p className="text-[10px] font-secondary text-stone-400">
            Matriz: {t.matrixMoved} de {t.matrixEligible} sesiones en modo escenario cambiaron al menos una
            variable emocional. Dispositivos: promedio en días con actividad.
          </p>
        </Panel>
      </div>

      <Panel
        title="Seguridad"
        subtitle="Cuando el participante escribe algo que podría ser una crisis real (no simulada)"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Sesiones pausadas" value={t.crisis.toString()} />
          <Metric label="Sesiones con activación" value={t.safetySessions.toString()} />
          <Metric label="Eligió: era ejercicio" value={t.crisisExercise.toString()} />
          <Metric label="Eligió: era real" value={t.crisisReal.toString()} />
        </div>
        <p className="text-[11px] font-secondary text-stone-500">
          {t.crisisUnbranched} sesiones pausadas sin respuesta del participante · {t.safetyActivations}{" "}
          mensajes con activación en total.
        </p>
        <details className="bg-warm-bg rounded-xl px-4 py-3 text-xs font-secondary text-stone-700">
          <summary className="font-bold text-stone-800 cursor-pointer">¿Qué son las capas de seguridad?</summary>
          <div className="space-y-2 mt-2">
            <p>
              El chatbot tiene tres sistemas que revisan cada mensaje del participante para detectar si está
              pasando por una crisis real. Cuando cualquiera se activa, la conversación se pausa y el
              participante ve una pantalla que le pregunta si era parte del ejercicio o algo real.
            </p>
            <ul className="space-y-1 pl-4 list-disc">
              <li>
                <span className="font-bold">L1 — Marcador del personaje:</span> Martina detecta cuando el
                participante sale del rol y escribe algo personal preocupante.
              </li>
              <li>
                <span className="font-bold">L2 — Clasificador con IA:</span> una segunda llamada al modelo
                clasifica el mensaje como normal, distrés o ideación real.
              </li>
              <li>
                <span className="font-bold">L3 — Reglas rápidas:</span> frases directas que pausan la
                conversación de inmediato, sin esperar a la IA.
              </li>
            </ul>
          </div>
        </details>
      </Panel>

      {(t.nudges > 0 || t.inactivity > 0) && (
        <Panel title="Inactividad" subtitle="Recordatorio a los 2 minutos sin respuesta; cierre a los 4">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Recordatorios" value={t.nudges.toString()} />
            <Metric label="Volvieron a escribir" value={formatRate(t.repliesAfterNudge, t.nudges)} />
            <Metric label="Cerradas por inactividad" value={t.inactivity.toString()} />
          </div>
        </Panel>
      )}
    </div>
  );
}

// ── Day view ───────────────────────────────────────────────────────────────

function GroupCard({ g }: { g: RollupGroup }) {
  const mentor = isMentor(g);
  const firstTurn = g.funnel?.started ?? g.sessionsStarted - (g.dwell.noStartCount ?? 0);
  const tags = [
    sourceLabel(g.source),
    ...(g.modo !== undefined && g.modo !== null ? [modoLabel(g.modo)] : []),
    ...(g.cohortCode !== null ? [`cohorte ${g.cohortCode}`] : []),
  ];

  return (
    <article className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="min-w-0">
          <h3 className="font-title uppercase tracking-wide text-stone-800 text-sm">{scenarioLabel(g.scenarioId)}</h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-warm-bg border border-stone-200 px-2 py-0.5 text-[10px] font-secondary text-stone-600">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-secondary text-2xl font-bold text-stone-800 tabular-nums">{g.sessionsStarted}</p>
          <p className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">sesiones</p>
        </div>
      </header>

      {mentor ? (
        <p className="font-secondary text-xs text-stone-500">{INDICATOR_COPY.mentorSessions.subtitle}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Llegaron a 5 min" value={`${g.sessionsComplete ?? 0} (${formatRate(g.sessionsComplete ?? 0, firstTurn)})`} />
            <Metric label="Permanencia mediana" value={g.dwell.count > 0 ? formatSeconds(g.dwell.medianSeconds) : "—"} />
            <Metric label="Turnos (mediana)" value={g.turns.count > 0 ? g.turns.medianTurns.toString() : "—"} />
            <Metric label="Conductas OASIS (mediana)" value={g.tagsPerSessionMedian.toString()} />
            <Metric label="Matriz se movió" value={formatRate(g.matrixMovedSessions, g.matrixEligibleSessions ?? g.sessionsStarted)} />
            <Metric label="Informes" value={g.funnel !== undefined ? g.funnel.reportReady.toString() : "—"} />
          </div>

          <div className="space-y-2">
            <h4 className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">Permanencia</h4>
            <DwellBar under5={g.dwell.under5Min} fiveTo10={g.dwell.fiveToTenMin} over10={g.dwell.overTenMin} />
          </div>

          <div className="space-y-2">
            <h4 className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">Cómo terminaron</h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-secondary text-stone-700">
              <EndRow label="Por el participante" v={g.ended.closed_completed + g.ended.completed_legacy} />
              <EndRow label="Inactividad" v={g.ended.closed_inactivity} />
              <EndRow label="Crisis" v={g.ended.crisis_interrupted} />
              {g.ended.active !== undefined && <EndRow label="Sin cerrar" v={g.ended.active} />}
            </ul>
          </div>

          {(g.crisis.safeguardActivations > 0 || g.ended.crisis_interrupted > 0) && (
            <div className="space-y-2">
              <h4 className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">Seguridad</h4>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-secondary text-stone-700">
                <EndRow label="Mensajes con activación" v={g.crisis.safeguardActivations} />
                <EndRow label="Eligió: ejercicio" v={g.crisis.crisisExercise} />
                <EndRow label="Eligió: real" v={g.crisis.crisisFlaggedReal} />
                <EndRow label="Sin respuesta" v={g.crisis.crisisUnbranched} />
              </ul>
            </div>
          )}
        </>
      )}
    </article>
  );
}

function EndRow({ label, v }: { label: string; v: number }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className="text-stone-500 truncate">{label}</span>
      <span className="font-bold tabular-nums text-stone-800">{v}</span>
    </li>
  );
}

function DayView({ rollups, yesterday }: { rollups: Map<string, RollupDocument>; yesterday: string }) {
  const [date, setDate] = useState<string>(yesterday);
  const rollup = rollups.get(date);
  const today = todayInSantiago();
  const groups = rollup?.groups ?? [];
  const coachGroups = groups.filter((g) => !isMentor(g));
  const mentorGroups = groups.filter(isMentor);
  const coachTotal = coachGroups.reduce((s, g) => s + g.sessionsStarted, 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-stone-200 px-5 py-4 flex flex-wrap items-end justify-between gap-4 shadow-sm">
        <label className="flex flex-col gap-1 text-[11px] font-secondary text-stone-500">
          <span className="uppercase tracking-wider">Fecha</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Día anterior"
              onClick={() => setDate((d) => shiftDate(d, -1))}
              className="rounded-lg border border-stone-200 bg-warm-bg w-8 h-8 text-stone-600 hover:bg-white"
            >
              ‹
            </button>
            <input
              type="date"
              value={date}
              max={yesterday}
              onChange={(e) => e.target.value !== "" && setDate(e.target.value)}
              className="rounded-lg border border-stone-200 bg-warm-bg px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-summer-blue/50"
            />
            <button
              type="button"
              aria-label="Día siguiente"
              disabled={date >= yesterday}
              onClick={() => setDate((d) => shiftDate(d, 1))}
              className="rounded-lg border border-stone-200 bg-warm-bg w-8 h-8 text-stone-600 hover:bg-white disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </label>
        {rollup !== undefined && (
          <div className="text-right">
            <p className="font-title text-stone-800 text-3xl tabular-nums leading-none">{coachTotal}</p>
            <p className="font-secondary text-[11px] text-stone-500 mt-1">
              sesiones con Martina · calculado {new Date(rollup.generatedAtIso).toLocaleString("es-CL")}
            </p>
          </div>
        )}
      </div>

      {rollup === undefined && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2 text-sm text-amber-900 font-secondary">
          <p className="font-semibold">
            {date >= today
              ? "Los datos de hoy se calculan mañana a las 04:00 (Santiago)."
              : `No hay cálculo para ${formatDateLong(date)}.`}
          </p>
          {date < today && (
            <code className="block bg-white/60 rounded-lg px-3 py-2 text-[11px] font-mono text-amber-800">
              pnpm --filter @salvador/functions backfill:analytics -- {date}
            </code>
          )}
        </div>
      )}

      {rollup !== undefined && groups.length === 0 && (
        <p className="text-stone-500 text-sm font-secondary italic">No hubo sesiones el {formatDateLong(date)}.</p>
      )}

      {coachGroups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {coachGroups.map((g) => (
            <GroupCard key={`${g.scenarioId}-${g.cohortCode ?? NONE}-${g.source ?? NONE}-${g.modo ?? NONE}`} g={g} />
          ))}
        </div>
      )}
      {mentorGroups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {mentorGroups.map((g) => (
            <GroupCard key={`mentor-${g.cohortCode ?? NONE}-${g.source ?? NONE}`} g={g} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type ViewMode = "periodo" | "dia";
type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; rollups: Map<string, RollupDocument> }
  | { kind: "error"; message: string };

export default function AdminAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("periodo");
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const attemptedAnonRef = useRef(false);

  // Firestore rules require `request.auth != null`. If nobody is signed in,
  // silently sign in anonymously — the page stays "open to all" without any
  // login flow. Idempotent via the ref.
  useEffect(() => {
    if (authLoading) return;
    if (user !== null) return;
    if (attemptedAnonRef.current) return;
    attemptedAnonRef.current = true;
    void signInAnon().catch(() => {
      // Anonymous auth disabled → the fetch below will fail and the user sees
      // the permission-denied error message. Nothing else to do here.
    });
  }, [authLoading, user]);

  // One read of the whole collection. Doc ids are YYYY-MM-DD and every doc
  // carries the same value in `date`, so ordering by it is chronological.
  useEffect(() => {
    if (authLoading || user === null) return;
    let cancelled = false;
    setLoad({ kind: "loading" });
    getDocs(query(collection(db, "analytics_rollups"), orderBy("date", "asc")))
      .then((snap) => {
        if (cancelled) return;
        const map = new Map<string, RollupDocument>();
        for (const d of snap.docs) map.set(d.id, d.data() as RollupDocument);
        setLoad({ kind: "ready", rollups: map });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoad({ kind: "error", message: err instanceof Error ? err.message : "Error desconocido" });
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const yesterday = shiftDate(todayInSantiago(), -1);

  return (
    <main className="min-h-screen bg-warm-bg">
      <header className="bg-white border-b border-stone-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-title uppercase tracking-wide text-stone-800 text-lg">Analítica</h1>
            <p className="font-secondary text-xs text-stone-500">Summer ChatBot · vista agregada, sin datos personales</p>
          </div>
          <Segmented
            ariaLabel="Vista"
            options={[
              { value: "periodo" as const, label: "Período" },
              { value: "dia" as const, label: "Día" },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div
          role="note"
          className="rounded-2xl shadow-sm px-5 py-3 bg-summer-yellow text-stone-800 font-secondary text-sm leading-relaxed"
        >
          Herramienta interna en calibración. Los datos son agregados y no personales; las métricas pueden
          cambiar mientras validamos el modelo de medición.
        </div>

        {load.kind === "loading" && <p className="text-stone-400 text-sm font-secondary">Cargando datos…</p>}

        {load.kind === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 font-secondary">
            No se pudieron leer los datos: {load.message}
          </div>
        )}

        {load.kind === "ready" && viewMode === "periodo" && (
          <PeriodView rollups={load.rollups} yesterday={yesterday} />
        )}
        {load.kind === "ready" && viewMode === "dia" && <DayView rollups={load.rollups} yesterday={yesterday} />}
      </div>
    </main>
  );
}
