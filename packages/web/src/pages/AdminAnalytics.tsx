// Analytics dashboard (Phase 6).
// Reads pre-computed rollups from analytics_rollups/{yyyymmdd}.
//
// PROTECTION MODEL — provisional. There is no user-facing gate; obscurity is
// the only protection ("/admin/analytics" is not linked from any participant
// page). Firestore rules require authentication to read the rollups, so a
// signed-in user (including anonymous /martina users) can view them. The data
// is aggregated and non-personal by design, so exposure is bounded to totals.
// Tighten to role=admin when we're ready.

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

// ── Group card ─────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; rollup: RollupDocument }
  | { kind: "error"; message: string };

export default function AdminAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const [date, setDate] = useState<string>(yesterdayInSantiago());
  const [state, setState] = useState<LoadState>({ kind: "loading" });
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

  // Rollup load for the selected date. Waits for auth to settle so the
  // Firestore read doesn't race the anonymous sign-in.
  useEffect(() => {
    if (authLoading || user === null) return;
    let cancelled = false;
    setState({ kind: "loading" });
    getDoc(doc(db, "analytics_rollups", date))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setState({ kind: "missing" });
          return;
        }
        const data = snap.data() as RollupDocument;
        setState({ kind: "ready", rollup: data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, date]);

  const today = todayInSantiago();

  const totalSessions = useMemo(() => {
    if (state.kind !== "ready") return 0;
    return state.rollup.groups.reduce((sum, g) => sum + g.sessionsStarted, 0);
  }, [state]);

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
          <label className="flex items-center gap-2 text-xs font-secondary text-stone-600 self-start sm:self-auto">
            <span>Fecha</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-stone-200 bg-warm-bg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50"
            />
          </label>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {state.kind === "loading" && (
          <p className="text-stone-400 text-sm">Cargando rollup para {date}…</p>
        )}

        {state.kind === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 font-secondary">
            Error al leer el rollup: {state.message}
          </div>
        )}

        {state.kind === "missing" && (
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

        {state.kind === "ready" && (
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
                generado {new Date(state.rollup.generatedAtIso).toLocaleString("es-CL")}
              </p>
            </div>

            {state.rollup.groups.length === 0 && (
              <p className="text-stone-500 text-sm font-secondary italic">
                No hay sesiones registradas para {date}.
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {state.rollup.groups.map((g, i) => (
                <GroupCard key={`${g.scenarioId}-${g.cohortCode ?? "none"}-${i}`} g={g} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
