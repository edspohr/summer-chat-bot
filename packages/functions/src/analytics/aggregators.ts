// Pure aggregation helpers — no Firestore reads inside. Called by the rollup
// scheduler and the backfill script with plain session/message data. Unit-
// testable in isolation.

import type { Timestamp } from "firebase-admin/firestore";
import { INITIAL_ESTADO_MATRIZ } from "../coach/matrixConstants.js";
import type { DwellStats, TurnStats, EndBreakdown, RollupGroup } from "@salvador/shared";

// ── Numeric helpers ────────────────────────────────────────────────────────

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = rank - lo;
  return sortedAsc[lo]! * (1 - frac) + sortedAsc[hi]! * frac;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 50);
}

// ── Dwell-time bucketing ───────────────────────────────────────────────────

// The "meaningful engagement" threshold used to bucket the dwell histogram.
// Exposed as a single constant so callers (dashboard, export script) can
// reference it without hard-coding "5". Revisit in MED-08 once we have
// pilot data on typical session length.
export const DWELL_THRESHOLD_MINUTES = 5;

const FIVE_MIN_S = DWELL_THRESHOLD_MINUTES * 60;
const TEN_MIN_S = 10 * 60;

export function computeDwellStats(
  dwellSecondsPerSession: number[],
  extras: { fallbackCount?: number; noStartCount?: number } = {},
): DwellStats {
  const sorted = [...dwellSecondsPerSession].sort((a, b) => a - b);
  let under5Min = 0;
  let fiveToTenMin = 0;
  let overTenMin = 0;
  for (const s of dwellSecondsPerSession) {
    if (s < FIVE_MIN_S) under5Min++;
    else if (s < TEN_MIN_S) fiveToTenMin++;
    else overTenMin++;
  }
  return {
    count: sorted.length,
    medianSeconds: Math.round(percentile(sorted, 50)),
    p25Seconds: Math.round(percentile(sorted, 25)),
    p75Seconds: Math.round(percentile(sorted, 75)),
    under5Min,
    fiveToTenMin,
    overTenMin,
    fallbackCount: extras.fallbackCount ?? 0,
    noStartCount: extras.noStartCount ?? 0,
  };
}

// ── Turn stats ─────────────────────────────────────────────────────────────

export function computeTurnStats(turnCountsPerSession: number[]): TurnStats {
  const total = turnCountsPerSession.reduce((a, b) => a + b, 0);
  return {
    count: turnCountsPerSession.length,
    medianTurns: Math.round(median(turnCountsPerSession)),
    totalTurns: total,
  };
}

// ── Session-level derivations ──────────────────────────────────────────────

export type DwellSource = "user_activity" | "fallback";

export interface DwellResult {
  seconds: number;
  source: DwellSource;
}

// MED-01: dwell time is now defined as the interval between the first user
// turn (`sesionIniciadaEn`) and the last user turn (`lastUserActivityAt`).
// This intentionally excludes assistant turns, nudges, timer ticks and report
// generation, which used to contaminate the old `lastActivityAt`-based value.
//
// Fallback path: if `lastUserActivityAt` is missing (historical rows written
// before MED-01), the caller can supply a `lastUserMessageAt` derived from
// the messages subcollection; failing that, `lastActivityAt` is used and the
// result is marked `source: "fallback"` so the dashboard can surface the
// dilution.
//
// Sessions without `sesionIniciadaEn` are excluded (returns null) and should
// be counted separately as "sin inicio" by the caller.
export function dwellSeconds(input: {
  sesionIniciadaEn: Timestamp | null | undefined;
  lastUserActivityAt: Timestamp | null | undefined;
  lastUserMessageAt?: Timestamp | null | undefined;
  lastActivityAt?: Timestamp | null | undefined;
}): DwellResult | null {
  const start = input.sesionIniciadaEn;
  if (start === undefined || start === null) return null;

  let end: Timestamp | null | undefined = input.lastUserActivityAt;
  let source: DwellSource = "user_activity";

  if (end === undefined || end === null) {
    end = input.lastUserMessageAt;
    source = "fallback";
  }
  if (end === undefined || end === null) {
    end = input.lastActivityAt;
    source = "fallback";
  }
  if (end === undefined || end === null) return null;

  const seconds = (end.toMillis() - start.toMillis()) / 1000;
  if (seconds < 0) return null;
  return { seconds, source };
}

// Whether the emotional matrix moved from its initial values by session end.
// Called with the FINAL estadoMatriz on the session doc.
export function matrixMoved(finalMatrix: {
  intensidadEmocional?: number;
  apertura?: number;
  confianzaEnLaAyuda?: number;
} | null | undefined): boolean {
  if (finalMatrix === null || finalMatrix === undefined) return false;
  const init = INITIAL_ESTADO_MATRIZ;
  return (
    (finalMatrix.intensidadEmocional !== undefined && finalMatrix.intensidadEmocional !== init.intensidadEmocional) ||
    (finalMatrix.apertura !== undefined && finalMatrix.apertura !== init.apertura) ||
    (finalMatrix.confianzaEnLaAyuda !== undefined && finalMatrix.confianzaEnLaAyuda !== init.confianzaEnLaAyuda)
  );
}

// ── End state breakdown ────────────────────────────────────────────────────

export function bucketEndState(state: string | undefined): keyof EndBreakdown | "unknown" {
  switch (state) {
    case "closed_completed":
      return "closed_completed";
    case "closed_inactivity":
      return "closed_inactivity";
    case "crisis_interrupted":
      return "crisis_interrupted";
    case "abandoned":
      return "abandoned";
    case "completed":
      return "completed_legacy";
    case "active":
      return "active";
    default:
      // Unknown/missing state — not counted in any end bucket.
      return "unknown";
  }
}

// ── Group builder ──────────────────────────────────────────────────────────

export interface GroupDims {
  scenarioId: string;
  cohortCode: string | null;
  source: string | null;
  modo: string | null;
}

export function emptyGroup(dims: GroupDims): RollupGroup {
  return {
    scenarioId: dims.scenarioId,
    cohortCode: dims.cohortCode,
    source: dims.source,
    modo: dims.modo,
    sessionsStarted: 0,
    sessionsComplete: 0,
    uniqueDevices: 0,
    ended: {
      closed_completed: 0,
      closed_inactivity: 0,
      crisis_interrupted: 0,
      abandoned: 0,
      completed_legacy: 0,
      active: 0,
    },
    dwell: {
      count: 0,
      medianSeconds: 0,
      p25Seconds: 0,
      p75Seconds: 0,
      under5Min: 0,
      fiveToTenMin: 0,
      overTenMin: 0,
    },
    turns: { count: 0, medianTurns: 0, totalTurns: 0 },
    tagsAwardedTotal: 0,
    tagsPerSessionMedian: 0,
    matrixMovedSessions: 0,
    matrixEligibleSessions: 0,
    matrixMovementRate: 0,
    crisis: {
      safeguardActivations: 0,
      crisisExercise: 0,
      crisisFlaggedReal: 0,
      crisisUnbranched: 0,
      sessionsWithActivation: 0,
    },
    nudgesSent: 0,
    repliesAfterNudge: 0,
    sessionsClosedByInactivity: 0,
    rateLimitedRejections: 0,
    funnel: { started: 0, threeTurnsPlus: 0, reportReady: 0, reflectionSubmitted: 0 },
  };
}

// Composite key for grouping: scenario × cohort × source × modo. Null → "__none".
export function groupKey(dims: GroupDims): string {
  const n = (v: string | null) => v ?? "__none";
  return `${dims.scenarioId}::${n(dims.cohortCode)}::${n(dims.source)}::${n(dims.modo)}`;
}

// Mentor sessions live in the same `sessions` collection with
// scenarioId "mentor" and no `modo`. They have no matrix and no Coach
// closing flow, so they get modo=null and are separated by the dashboard.
export function sessionModo(scenarioId: string, modo: string | undefined | null): string | null {
  if (scenarioId === MENTOR_SCENARIO_ID) return null;
  return typeof modo === "string" && modo.length > 0 ? modo : "escenario";
}

export const MENTOR_SCENARIO_ID = "mentor";

// Minimum trainee turns for a formative report (CLAUDE.md §13).
export const REPORT_MIN_TURNS = 3;

export function isReportReady(status: unknown): boolean {
  return status === "ready" || status === "minimal";
}

// ── Santiago-day helpers ───────────────────────────────────────────────────

// Return the calendar day (Santiago) for a JS Date, formatted YYYY-MM-DD.
export function toSantiagoDate(d: Date): string {
  // en-CA gives YYYY-MM-DD; timezone América/Santiago pins the day boundary.
  return d.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

// Given a YYYY-MM-DD in Santiago, return the [startMs, endMsExclusive) window
// in UTC epoch ms. Used to build Firestore range queries.
export function santiagoDayWindow(dateStr: string): { startMs: number; endMs: number } {
  // Santiago is UTC-4 (CLT) or UTC-3 (CLST). Instead of computing offset by
  // hand, use Intl to figure out the ms offset at that day's midnight.
  const midnightUtcGuess = new Date(`${dateStr}T00:00:00Z`).getTime();
  // Format that ms back to Santiago and read the resulting hour — if it's not
  // 00 we're off by (24 - hour) hours (mod 24). Then correct.
  const guessedSantiagoHour = Number(
    new Date(midnightUtcGuess).toLocaleString("en-US", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      hour12: false,
    }),
  );
  const offsetHours = guessedSantiagoHour === 0 ? 0 : (24 - guessedSantiagoHour) % 24;
  const startMs = midnightUtcGuess + offsetHours * 3600_000;
  const endMs = startMs + 24 * 3600_000;
  return { startMs, endMs };
}
