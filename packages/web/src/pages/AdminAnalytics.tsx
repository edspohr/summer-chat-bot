// Analytics dashboard (Phase 6 + 7).
// Reads pre-computed rollups from analytics_rollups/{yyyymmdd}.
//
// PROTECTION MODEL — provisional. There is no user-facing gate; obscurity is
// the only protection ("/admin/analytics" is not linked from any participant
// page). Firestore rules require authentication to read the rollups, so a
// signed-in user (including anonymous /martina users) can view them. The data
// is aggregated and non-personal by design, so exposure is bounded to totals.
// Tighten to role=admin when we're ready.
//
// Two views:
//   - "day"      : single-day snapshot (original Phase 6 view).
//   - "historic" : rolling 90-day aggregate with cohort selector and daily
//                  stacked bar chart (Phase 7).

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import type { RollupDocument, RollupGroup } from "@salvador/shared";
import { useAuth } from "../hooks/useAuth.js";
import { signInAnon } from "../lib/auth.js";
import { db } from "../firebase.js";

// Santiago-local calendar day. Uses en-CA to get YYYY-MM-DD.
function todayInSantiago(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

function yesterdayInSantiago(): string {
  const now = Date.now() - 24 * 3600_000;
  return new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (m === 0) return `${sec}s`;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

const HISTORIC_WINDOW_DAYS = 90;

// ── Day view — GroupCard (unchanged from Phase 6) ──────────────────────────

function GroupCard({ g }: { g: RollupGroup }) {
  const completionRate =
    g.sessionsStarted === 0
      ? 0
      : (g.ended.closed_completed + g.ended.completed_legacy) / g.sessionsStarted;

  return (
    <article className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm">
      <header className="flex items-baseline justify-between border-b border-stone-100 pb-3">
        <div>
          <h3 className="font-title uppercase tracking-wide text-stone-800 text-sm">
            {g.scenarioId}
          </h3>
          <p className="font-secondary text-xs text-stone-500">
            {g.cohortCode !== null ? `cohort: ${g.cohortCode}` : "sin cohort code"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-secondary text-2xl font-bold text-stone-800 tabular-nums">
            {g.sessionsStarted}
          </p>
          <p className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">
            sesiones
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 text-xs font-secondary">
        <Metric label="Dispositivos únicos" value={g.uniqueDevices.toString()} />
        <Metric label="Tasa completación" value={formatPercent(completionRate)} />
        <Metric
          label="Dwell mediano"
          value={g.dwell.count > 0 ? formatSeconds(g.dwell.medianSeconds) : "—"}
        />
        <Metric
          label="Turnos mediana"
          value={g.turns.count > 0 ? g.turns.medianTurns.toString() : "—"}
        />
        <Metric label="Tags/sesión (med)" value={g.tagsPerSessionMedian.toString()} />
        <Metric label="Matriz movió %" value={formatPercent(g.matrixMovementRate)} />
      </div>

      <div className="space-y-2">
        <h4 className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">
          Distribución dwell time
        </h4>
        <DwellBar dwell={g.dwell} />
      </div>

      <div className="space-y-2">
        <h4 className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">
          Cómo cerraron
        </h4>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-secondary text-stone-700">
          <EndRow label="Completada" v={g.ended.closed_completed} />
          <EndRow label="Inactividad" v={g.ended.closed_inactivity} />
          <EndRow label="Crisis" v={g.ended.crisis_interrupted} />
          <EndRow label="Abandonada" v={g.ended.abandoned} />
          {g.ended.completed_legacy > 0 && (
            <EndRow label="Legacy (pre-fase 2)" v={g.ended.completed_legacy} />
          )}
        </ul>
      </div>

      {(g.crisis.safeguardActivations > 0 ||
        g.crisis.crisisExercise > 0 ||
        g.crisis.crisisFlaggedReal > 0 ||
        g.crisis.crisisUnbranched > 0) && (
        <div className="space-y-2">
          <h4 className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">
            Safety
          </h4>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-secondary text-stone-700">
            <EndRow label="Activaciones L1/L2/L3" v={g.crisis.safeguardActivations} />
            <EndRow label="Branch: ejercicio" v={g.crisis.crisisExercise} />
            <EndRow label="Branch: real" v={g.crisis.crisisFlaggedReal} />
            <EndRow label="Sin branch elegido" v={g.crisis.crisisUnbranched} />
          </ul>
        </div>
      )}

      {(g.nudgesSent > 0 || g.sessionsClosedByInactivity > 0 || g.rateLimitedRejections > 0) && (
        <div className="space-y-2">
          <h4 className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">
            Operacional
          </h4>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-secondary text-stone-700">
            <EndRow label="Nudges enviados" v={g.nudgesSent} />
            <EndRow label="Respondió tras nudge" v={g.repliesAfterNudge} />
            <EndRow label="Cerrada por inactividad" v={g.sessionsClosedByInactivity} />
            {g.rateLimitedRejections > 0 && (
              <EndRow label="Rate limit" v={g.rateLimitedRejections} />
            )}
          </ul>
        </div>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-warm-bg px-3 py-2">
      <p className="text-stone-500 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-stone-800 text-sm font-bold tabular-nums">{value}</p>
    </div>
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

// Horizontal stacked bar showing dwell-time buckets.
function DwellBar({ dwell }: { dwell: RollupGroup["dwell"] }) {
  const total = dwell.under5Min + dwell.fiveToTenMin + dwell.overTenMin;
  if (total === 0) {
    return <p className="text-stone-400 text-xs italic">Sin sesiones con dwell registrado.</p>;
  }
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded-full overflow-hidden bg-stone-100">
        <div
          className="bg-summer-peach"
          style={{ width: `${pct(dwell.under5Min)}%` }}
          title={`<5min: ${dwell.under5Min}`}
        />
        <div
          className="bg-summer-yellow"
          style={{ width: `${pct(dwell.fiveToTenMin)}%` }}
          title={`5-10min: ${dwell.fiveToTenMin}`}
        />
        <div
          className="bg-summer-teal"
          style={{ width: `${pct(dwell.overTenMin)}%` }}
          title={`>10min: ${dwell.overTenMin}`}
        />
      </div>
      <div className="flex justify-between text-[10px] font-secondary text-stone-500">
        <span>&lt;5min: {dwell.under5Min}</span>
        <span>5–10: {dwell.fiveToTenMin}</span>
        <span>&gt;10: {dwell.overTenMin}</span>
      </div>
      <p className="text-[10px] font-secondary text-stone-400">
        p25 {formatSeconds(dwell.p25Seconds)} · p75 {formatSeconds(dwell.p75Seconds)}
      </p>
    </div>
  );
}

// ── Historic view — aggregation ────────────────────────────────────────────

// Doc IDs in analytics_rollups are YYYY-MM-DD (with dashes). Matches
// rollupBuilder.writeRollup which uses rollup.date directly.
function docIdForDate(dateStr: string): string {
  return dateStr;
}

function last90SantiagoDates(): string[] {
  const dates: string[] = [];
  const now = Date.now();
  for (let i = HISTORIC_WINDOW_DAYS - 1; i >= 0; i--) {
    const ms = now - i * 24 * 3600_000;
    dates.push(new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Santiago" }));
  }
  return dates;
}

interface DailyPoint {
  date: string;
  completed: number;
  inactivity: number;
  crisis: number;
  abandoned: number;
}

interface HistoricAggregate {
  daysWithData: number;
  totalSessions: number;
  totalCompleted: number;
  completionRate: number;
  uniqueDevicesAvgPerDay: number;
  matrixMovementRate: number;
  matrixMovedSessions: number;
  totalSafeguardActivations: number;
  crisisExercise: number;
  crisisFlaggedReal: number;
  crisisUnbranched: number;
  nudgesSent: number;
  repliesAfterNudge: number;
  sessionsClosedByInactivity: number;
  // Dwell — approximate medians via session-weighted average of daily medians.
  dwell: {
    sessionsWithDwell: number;
    medianSeconds: number;
    p25Seconds: number;
    p75Seconds: number;
    under5Min: number;
    fiveToTenMin: number;
    overTenMin: number;
  };
  daily: DailyPoint[];
  cohortCodes: string[]; // sorted, includes "__none" placeholder
}

// Weighted average of per-day values. Skips days with zero weight.
function weightedAvg(pairs: Array<{ value: number; weight: number }>): number {
  let sumWV = 0;
  let sumW = 0;
  for (const p of pairs) {
    if (p.weight <= 0) continue;
    sumWV += p.value * p.weight;
    sumW += p.weight;
  }
  return sumW === 0 ? 0 : sumWV / sumW;
}

function aggregateRollups(
  rollupsByDate: Map<string, RollupDocument>,
  cohortFilter: string | null, // null = all cohorts
): HistoricAggregate {
  const daily: DailyPoint[] = [];
  const cohortSet = new Set<string>();

  let totalSessions = 0;
  let totalCompleted = 0;
  let matrixMovedSessions = 0;
  let uniqueDevicesSum = 0;
  let daysWithData = 0;

  let dwellSessions = 0;
  let dwellUnder5 = 0;
  let dwell5to10 = 0;
  let dwellOver10 = 0;
  const dwellMedianPairs: Array<{ value: number; weight: number }> = [];
  const dwellP25Pairs: Array<{ value: number; weight: number }> = [];
  const dwellP75Pairs: Array<{ value: number; weight: number }> = [];

  let totalSafeguardActivations = 0;
  let crisisExercise = 0;
  let crisisFlaggedReal = 0;
  let crisisUnbranched = 0;
  let nudgesSent = 0;
  let repliesAfterNudge = 0;
  let sessionsClosedByInactivity = 0;

  // Sort dates ascending so `daily` is chronological (chart draws left→right).
  const sortedDates = [...rollupsByDate.keys()].sort();

  for (const date of sortedDates) {
    const rollup = rollupsByDate.get(date)!;

    // Discover every cohort that appears in the window (for the selector).
    for (const g of rollup.groups) {
      cohortSet.add(g.cohortCode ?? "__none");
    }

    const groups = rollup.groups.filter((g) => {
      if (cohortFilter === null) return true;
      const key = g.cohortCode ?? "__none";
      return key === cohortFilter;
    });

    if (groups.length === 0) {
      daily.push({ date, completed: 0, inactivity: 0, crisis: 0, abandoned: 0 });
      continue;
    }

    let dayCompleted = 0;
    let dayInactivity = 0;
    let dayCrisis = 0;
    let dayAbandoned = 0;
    let daySessions = 0;
    let dayDevices = 0;

    for (const g of groups) {
      daySessions += g.sessionsStarted;
      dayDevices += g.uniqueDevices;
      dayCompleted += g.ended.closed_completed + g.ended.completed_legacy;
      dayInactivity += g.ended.closed_inactivity;
      dayCrisis += g.ended.crisis_interrupted;
      dayAbandoned += g.ended.abandoned;

      matrixMovedSessions += g.matrixMovedSessions;
      totalSafeguardActivations += g.crisis.safeguardActivations;
      crisisExercise += g.crisis.crisisExercise;
      crisisFlaggedReal += g.crisis.crisisFlaggedReal;
      crisisUnbranched += g.crisis.crisisUnbranched;
      nudgesSent += g.nudgesSent;
      repliesAfterNudge += g.repliesAfterNudge;
      sessionsClosedByInactivity += g.sessionsClosedByInactivity;

      if (g.dwell.count > 0) {
        dwellSessions += g.dwell.count;
        dwellUnder5 += g.dwell.under5Min;
        dwell5to10 += g.dwell.fiveToTenMin;
        dwellOver10 += g.dwell.overTenMin;
        dwellMedianPairs.push({ value: g.dwell.medianSeconds, weight: g.dwell.count });
        dwellP25Pairs.push({ value: g.dwell.p25Seconds, weight: g.dwell.count });
        dwellP75Pairs.push({ value: g.dwell.p75Seconds, weight: g.dwell.count });
      }
    }

    if (daySessions > 0) {
      daysWithData++;
      uniqueDevicesSum += dayDevices;
    }

    totalSessions += daySessions;
    totalCompleted += dayCompleted;

    daily.push({
      date,
      completed: dayCompleted,
      inactivity: dayInactivity,
      crisis: dayCrisis,
      abandoned: dayAbandoned,
    });
  }

  const completionRate = totalSessions === 0 ? 0 : totalCompleted / totalSessions;
  const matrixMovementRate = totalSessions === 0 ? 0 : matrixMovedSessions / totalSessions;
  const uniqueDevicesAvgPerDay =
    daysWithData === 0 ? 0 : Math.round((uniqueDevicesSum / daysWithData) * 10) / 10;

  const cohortCodes = [...cohortSet].sort();

  return {
    daysWithData,
    totalSessions,
    totalCompleted,
    completionRate,
    uniqueDevicesAvgPerDay,
    matrixMovementRate,
    matrixMovedSessions,
    totalSafeguardActivations,
    crisisExercise,
    crisisFlaggedReal,
    crisisUnbranched,
    nudgesSent,
    repliesAfterNudge,
    sessionsClosedByInactivity,
    dwell: {
      sessionsWithDwell: dwellSessions,
      medianSeconds: Math.round(weightedAvg(dwellMedianPairs)),
      p25Seconds: Math.round(weightedAvg(dwellP25Pairs)),
      p75Seconds: Math.round(weightedAvg(dwellP75Pairs)),
      under5Min: dwellUnder5,
      fiveToTenMin: dwell5to10,
      overTenMin: dwellOver10,
    },
    daily,
    cohortCodes,
  };
}

// ── Historic view — stacked bar chart (SVG, no dep) ────────────────────────

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

  const maxTotal = daily.reduce(
    (m, d) => Math.max(m, d.completed + d.inactivity + d.crisis + d.abandoned),
    0,
  );
  // Round the axis max up to a "nice" number so gridlines land on integers.
  const axisMax = maxTotal === 0 ? 1 : Math.max(1, Math.ceil(maxTotal / 5) * 5);
  const barW = chartW / daily.length;

  const yFor = (v: number) => padTop + chartH - (v / axisMax) * chartH;
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(axisMax * f));

  const hovered: DailyPoint | null = hoverIdx !== null ? daily[hoverIdx] ?? null : null;
  const hoveredTotal =
    hovered !== null
      ? hovered.completed + hovered.inactivity + hovered.crisis + hovered.abandoned
      : 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Sesiones por día apiladas por estado final"
        >
          {/* Gridlines */}
          {gridValues.map((v) => (
            <g key={v}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={yFor(v)}
                y2={yFor(v)}
                stroke="#e7e5e4"
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={yFor(v) + 3}
                textAnchor="end"
                className="fill-stone-400"
                fontSize={9}
              >
                {v}
              </text>
            </g>
          ))}

          {/* Bars */}
          {daily.map((d, i) => {
            const total = d.completed + d.inactivity + d.crisis + d.abandoned;
            if (total === 0) return null;
            const x = padLeft + i * barW;
            const w = Math.max(1, barW - 1);
            let cursorY = padTop + chartH;
            const segments: Array<{ v: number; color: string }> = [
              { v: d.completed, color: "#2A9D8F" }, // summer-teal
              { v: d.inactivity, color: "#E9C46A" }, // summer-yellow
              { v: d.crisis, color: "#F4A261" }, // summer-peach
              { v: d.abandoned, color: "#a8a29e" }, // stone-400
            ];
            return (
              <g
                key={d.date}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
              >
                {/* invisible full-height rect for easier hover */}
                <rect
                  x={x}
                  y={padTop}
                  width={w}
                  height={chartH}
                  fill="transparent"
                />
                {segments.map((s, si) => {
                  if (s.v === 0) return null;
                  const h = (s.v / axisMax) * chartH;
                  cursorY -= h;
                  return (
                    <rect
                      key={si}
                      x={x}
                      y={cursorY}
                      width={w}
                      height={h}
                      fill={s.color}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X-axis: show a few date labels evenly spaced */}
          {daily.map((d, i) => {
            const shouldLabel = i === 0 || i === daily.length - 1 || i % 15 === 0;
            if (!shouldLabel) return null;
            const x = padLeft + i * barW + barW / 2;
            const label = d.date.slice(5); // MM-DD
            return (
              <text
                key={`x-${d.date}`}
                x={x}
                y={height - padBottom + 14}
                textAnchor="middle"
                className="fill-stone-400"
                fontSize={9}
              >
                {label}
              </text>
            );
          })}
        </svg>

        {hovered !== null && (
          <div className="absolute top-1 right-1 bg-white border border-stone-200 rounded-lg px-3 py-2 shadow-sm text-[11px] font-secondary text-stone-700 min-w-[140px] pointer-events-none">
            <p className="font-bold text-stone-800 mb-1">{hovered.date}</p>
            <p>Total: <span className="tabular-nums font-bold">{hoveredTotal}</span></p>
            <p className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-summer-teal" />
              Completadas: <span className="tabular-nums ml-auto">{hovered.completed}</span>
            </p>
            <p className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-summer-yellow" />
              Inactividad: <span className="tabular-nums ml-auto">{hovered.inactivity}</span>
            </p>
            <p className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-summer-peach" />
              Crisis: <span className="tabular-nums ml-auto">{hovered.crisis}</span>
            </p>
            <p className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-stone-400" />
              Abandonadas: <span className="tabular-nums ml-auto">{hovered.abandoned}</span>
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-secondary text-stone-600">
        <LegendItem color="bg-summer-teal" label="Completadas" />
        <LegendItem color="bg-summer-yellow" label="Inactividad" />
        <LegendItem color="bg-summer-peach" label="Crisis" />
        <LegendItem color="bg-stone-400" label="Abandonadas" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

// ── Historic view — page section ───────────────────────────────────────────

function HistoricView({
  rollupsByDate,
  loadState,
}: {
  rollupsByDate: Map<string, RollupDocument>;
  loadState: "loading" | "ready" | "error";
}) {
  // Discover cohorts across the whole window (independent of filter).
  const allCohorts = useMemo(() => {
    const s = new Set<string>();
    for (const rollup of rollupsByDate.values()) {
      for (const g of rollup.groups) {
        s.add(g.cohortCode ?? "__none");
      }
    }
    return [...s].sort();
  }, [rollupsByDate]);

  const [selectedCohort, setSelectedCohort] = useState<string>("__all");

  const agg = useMemo(
    () =>
      aggregateRollups(
        rollupsByDate,
        selectedCohort === "__all" ? null : selectedCohort,
      ),
    [rollupsByDate, selectedCohort],
  );

  if (loadState === "loading") {
    return <p className="text-stone-400 text-sm">Cargando últimos {HISTORIC_WINDOW_DAYS} días…</p>;
  }

  return (
    <div className="space-y-5">
      {/* Filter row */}
      <div className="flex flex-wrap items-baseline gap-3">
        <label className="flex items-center gap-2 text-xs font-secondary text-stone-600">
          <span>Cohorte</span>
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            className="rounded-lg border border-stone-200 bg-warm-bg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50"
          >
            <option value="__all">Todas las cohortes</option>
            {allCohorts.map((c) => (
              <option key={c} value={c}>
                {c === "__none" ? "(sin cohorte)" : c}
              </option>
            ))}
          </select>
        </label>
        <p className="font-secondary text-[11px] text-stone-400 ml-auto">
          {agg.daysWithData} de {HISTORIC_WINDOW_DAYS} días con sesiones
        </p>
      </div>

      {/* Headline aggregate stats */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <BigStat label="Total sesiones" value={agg.totalSessions.toString()} />
          <BigStat
            label="Dispositivos únicos/día"
            value={agg.uniqueDevicesAvgPerDay.toString()}
            hint="Promedio por día. Sumar días cuenta doble a quien vuelve — por eso se muestra promedio."
          />
          <BigStat
            label="Tasa completación"
            value={formatPercent(agg.completionRate)}
          />
          <BigStat
            label="Matriz movió %"
            value={formatPercent(agg.matrixMovementRate)}
            hint="% de sesiones donde al menos una variable emocional cambió desde el valor inicial."
          />
          <BigStat
            label="Activaciones safety"
            value={agg.totalSafeguardActivations.toString()}
            hint="Suma total de activaciones L1 + L2 + L3 en el período."
          />
        </div>
      </div>

      {/* Central chart */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="font-title uppercase tracking-wide text-stone-800 text-sm">
              Sesiones por día
            </h3>
            <p className="font-secondary text-[11px] text-stone-500">
              Últimos {HISTORIC_WINDOW_DAYS} días · apiladas por estado final
            </p>
          </div>
        </div>
        {agg.totalSessions === 0 ? (
          <p className="text-stone-400 text-sm italic py-6">
            Sin sesiones en el período seleccionado.
          </p>
        ) : (
          <StackedBarChart daily={agg.daily} />
        )}
      </section>

      {/* Dwell panel */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
        <div>
          <h3 className="font-title uppercase tracking-wide text-stone-800 text-sm">
            Dwell time (tiempo en la conversación)
          </h3>
          <p className="font-secondary text-[11px] text-stone-500">
            {agg.dwell.sessionsWithDwell} sesiones con duración registrada
          </p>
        </div>

        {agg.dwell.sessionsWithDwell === 0 ? (
          <p className="text-stone-400 text-sm italic">Sin datos de duración.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Mediana*" value={formatSeconds(agg.dwell.medianSeconds)} />
              <Metric label="p25*" value={formatSeconds(agg.dwell.p25Seconds)} />
              <Metric label="p75*" value={formatSeconds(agg.dwell.p75Seconds)} />
            </div>
            <DwellBar
              dwell={{
                count: agg.dwell.sessionsWithDwell,
                medianSeconds: agg.dwell.medianSeconds,
                p25Seconds: agg.dwell.p25Seconds,
                p75Seconds: agg.dwell.p75Seconds,
                under5Min: agg.dwell.under5Min,
                fiveToTenMin: agg.dwell.fiveToTenMin,
                overTenMin: agg.dwell.overTenMin,
              }}
            />
            <p className="text-[10px] font-secondary text-stone-400 italic">
              * Medianas aproximadas — promedio ponderado de las medianas diarias.
              Los conteos de rangos (&lt;5, 5–10, &gt;10 min) sí son exactos.
            </p>
          </>
        )}
      </section>

      {/* Matrix panel */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
        <div>
          <h3 className="font-title uppercase tracking-wide text-stone-800 text-sm">
            Movimiento de matriz emocional
          </h3>
          <p className="font-secondary text-[11px] text-stone-500">
            Sesiones donde intensidad, apertura o confianza cambiaron desde el estado inicial
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Movieron matriz" value={agg.matrixMovedSessions.toString()} />
          <Metric
            label="No movieron"
            value={Math.max(0, agg.totalSessions - agg.matrixMovedSessions).toString()}
          />
          <Metric label="% movió" value={formatPercent(agg.matrixMovementRate)} />
        </div>
      </section>

      {/* Safety panel */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-title uppercase tracking-wide text-stone-800 text-sm">
            Safety — capas de detección de crisis
          </h3>
          <p className="font-secondary text-[11px] text-stone-500">
            Cuando la aprendiz escribe algo que suena a crisis real (no simulada)
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Total activaciones" value={agg.totalSafeguardActivations.toString()} />
          <Metric label="Branch: ejercicio" value={agg.crisisExercise.toString()} />
          <Metric label="Branch: real" value={agg.crisisFlaggedReal.toString()} />
          <Metric label="Sin branch elegido" value={agg.crisisUnbranched.toString()} />
        </div>

        <div className="bg-warm-bg rounded-xl p-4 text-xs font-secondary text-stone-700 space-y-2">
          <p className="font-bold text-stone-800">¿Qué son las capas de safety?</p>
          <p>
            El chatbot tiene tres sistemas que revisan cada mensaje de la aprendiz para
            detectar si está pasando por una crisis real (no simulada). Cuando cualquiera
            se activa, la conversación se pausa y la aprendiz recibe una pantalla
            formativa preguntándole si fue un ejercicio o algo real.
          </p>
          <ul className="space-y-1 pl-4 list-disc">
            <li>
              <span className="font-bold">L1 — Marcador interno del personaje:</span>{" "}
              Martina detecta cuando la aprendiz sale del rol y escribe algo personal
              preocupante.
            </li>
            <li>
              <span className="font-bold">L2 — Clasificador con IA:</span>{" "}
              una segunda llamada al modelo revisa el mensaje y lo clasifica como
              normal, distrés, o ideación real.
            </li>
            <li>
              <span className="font-bold">L3 — Reglas rápidas:</span>{" "}
              una lista de frases directas (por ejemplo "me quiero matar", "tengo
              pastillas para…") que activa la pausa inmediatamente, sin esperar a la IA.
            </li>
          </ul>
        </div>
      </section>

      {/* Operational panel */}
      {(agg.nudgesSent > 0 || agg.sessionsClosedByInactivity > 0) && (
        <section className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
          <h3 className="font-title uppercase tracking-wide text-stone-800 text-sm">
            Operacional
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Nudges enviados" value={agg.nudgesSent.toString()} />
            <Metric label="Respondió tras nudge" value={agg.repliesAfterNudge.toString()} />
            <Metric
              label="Cerradas por inactividad"
              value={agg.sessionsClosedByInactivity.toString()}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function BigStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1" title={hint}>
      <p className="font-secondary text-[10px] uppercase tracking-wider text-stone-500">
        {label}
        {hint !== undefined && <span className="ml-1 text-stone-400 cursor-help">ⓘ</span>}
      </p>
      <p className="font-title text-stone-800 text-2xl md:text-3xl tabular-nums">{value}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type DayLoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; rollup: RollupDocument }
  | { kind: "error"; message: string };

type ViewMode = "day" | "historic";

export default function AdminAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("historic");
  const [date, setDate] = useState<string>(yesterdayInSantiago());
  const [dayState, setDayState] = useState<DayLoadState>({ kind: "loading" });
  const [historicRollups, setHistoricRollups] = useState<Map<string, RollupDocument>>(new Map());
  const [historicLoadState, setHistoricLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
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

  // Day-view load.
  useEffect(() => {
    if (viewMode !== "day") return;
    if (authLoading || user === null) return;
    let cancelled = false;
    setDayState({ kind: "loading" });
    getDoc(doc(db, "analytics_rollups", docIdForDate(date)))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setDayState({ kind: "missing" });
          return;
        }
        const data = snap.data() as RollupDocument;
        setDayState({ kind: "ready", rollup: data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDayState({
          kind: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, date, viewMode]);

  // Historic-view load — parallel getDoc for the last 90 days.
  // Missing days are ignored (Firestore returns snap.exists()===false).
  useEffect(() => {
    if (viewMode !== "historic") return;
    if (authLoading || user === null) return;
    let cancelled = false;
    setHistoricLoadState("loading");
    const dates = last90SantiagoDates();
    Promise.all(
      dates.map((d) =>
        getDoc(doc(db, "analytics_rollups", docIdForDate(d))).then((snap) => ({
          date: d,
          data: snap.exists() ? (snap.data() as RollupDocument) : null,
        })),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const map = new Map<string, RollupDocument>();
        for (const r of results) {
          if (r.data !== null) map.set(r.date, r.data);
        }
        setHistoricRollups(map);
        setHistoricLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setHistoricLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, viewMode]);

  const today = todayInSantiago();

  const totalSessions = useMemo(() => {
    if (dayState.kind !== "ready") return 0;
    return dayState.rollup.groups.reduce((sum, g) => sum + g.sessionsStarted, 0);
  }, [dayState]);

  return (
    <main className="min-h-screen bg-warm-bg">
      <header className="bg-white border-b border-stone-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-title uppercase tracking-wide text-stone-800 text-lg">
              Analytics
            </h1>
            <p className="font-secondary text-xs text-stone-500">
              Vista agregada · no personal
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="inline-flex rounded-lg border border-stone-200 bg-warm-bg p-0.5 text-xs font-secondary">
              <button
                type="button"
                onClick={() => setViewMode("historic")}
                className={`px-3 py-1.5 rounded-md transition ${
                  viewMode === "historic"
                    ? "bg-white text-stone-800 shadow-sm font-bold"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                90 días
              </button>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`px-3 py-1.5 rounded-md transition ${
                  viewMode === "day"
                    ? "bg-white text-stone-800 shadow-sm font-bold"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Día
              </button>
            </div>

            {viewMode === "day" && (
              <label className="flex items-center gap-2 text-xs font-secondary text-stone-600">
                <span>Fecha</span>
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-stone-200 bg-warm-bg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50"
                />
              </label>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {viewMode === "day" && (
          <>
            {dayState.kind === "loading" && (
              <p className="text-stone-400 text-sm">Cargando rollup para {date}…</p>
            )}

            {dayState.kind === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 font-secondary">
                Error al leer el rollup: {dayState.message}
              </div>
            )}

            {dayState.kind === "missing" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2 text-sm text-amber-900 font-secondary">
                <p className="font-semibold">No hay rollup para {date} todavía.</p>
                <p className="text-xs">
                  El rollup diario corre a las 04:00 Santiago. Para fechas históricas
                  podés correr el backfill:
                </p>
                <code className="block bg-white/60 rounded-lg px-3 py-2 text-[11px] font-mono text-amber-800">
                  pnpm --filter @salvador/functions backfill:analytics -- {date}
                </code>
              </div>
            )}

            {dayState.kind === "ready" && (
              <>
                <div className="bg-white rounded-2xl border border-stone-200 px-5 py-4 flex items-baseline justify-between shadow-sm">
                  <div>
                    <p className="font-secondary text-xs text-stone-500 uppercase tracking-wider">
                      Total sesiones
                    </p>
                    <p className="font-title text-stone-800 text-3xl tabular-nums">
                      {totalSessions}
                    </p>
                  </div>
                  <p className="font-secondary text-[11px] text-stone-400">
                    generado {new Date(dayState.rollup.generatedAtIso).toLocaleString("es-CL")}
                  </p>
                </div>

                {dayState.rollup.groups.length === 0 && (
                  <p className="text-stone-500 text-sm font-secondary italic">
                    No hay sesiones registradas para {date}.
                  </p>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {dayState.rollup.groups.map((g, i) => (
                    <GroupCard key={`${g.scenarioId}-${g.cohortCode ?? "none"}-${i}`} g={g} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {viewMode === "historic" && (
          <>
            {historicLoadState === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 font-secondary">
                Error al leer los rollups históricos.
              </div>
            )}
            {historicLoadState !== "error" && (
              <HistoricView
                rollupsByDate={historicRollups}
                loadState={historicLoadState}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
