// Analytics rollup document shape (Phase 6). Written by the daily scheduler and
// the one-shot backfill in @salvador/functions. Read by the /admin/analytics
// page in @salvador/web.
//
// Field names are load-bearing — the admin page reads them directly. See the
// Phase 6 checkpoint note before renaming.

export interface DwellStats {
  count: number;
  medianSeconds: number;
  p25Seconds: number;
  p75Seconds: number;
  under5Min: number;
  fiveToTenMin: number;
  overTenMin: number;
  // MED-01: sessions whose dwell was computed from a fallback source
  // (last user message in the messages subcollection, or lastActivityAt)
  // because `lastUserActivityAt` was absent. Optional to preserve back-compat
  // with rollup docs written before MED-01.
  fallbackCount?: number;
  // Sessions in the day range that had no `sesionIniciadaEn` (the first user
  // turn never fired). Excluded from `count` and from all percentile stats.
  noStartCount?: number;
}

export interface TurnStats {
  count: number;
  medianTurns: number;
  totalTurns: number;
}

export interface EndBreakdown {
  closed_completed: number;
  closed_inactivity: number;
  crisis_interrupted: number;
  abandoned: number;
  // Legacy "completed" (pre-Phase 2). Sessions that pre-date the state
  // extension roll up here instead of closed_completed.
  completed_legacy: number;
}

export interface CrisisBreakdown {
  safeguardActivations: number;
  crisisExercise: number;
  crisisFlaggedReal: number;
  // crisis_interrupted state but the trainee never picked a branch.
  crisisUnbranched: number;
}

export interface RollupGroup {
  scenarioId: string;
  cohortCode: string | null;

  sessionsStarted: number;
  /**
   * Sessions whose dwell time reached the "session complete" threshold
   * (SESSION_COMPLETE_AT_SECONDS, currently 5 minutes). Includes sessions still
   * active if they've already crossed the bar. Missing dwell → not counted.
   */
  sessionsComplete: number;
  uniqueDevices: number;

  ended: EndBreakdown;
  dwell: DwellStats;
  turns: TurnStats;

  tagsAwardedTotal: number;
  tagsPerSessionMedian: number;

  matrixMovedSessions: number;
  matrixMovementRate: number; // 0..1

  crisis: CrisisBreakdown;

  nudgesSent: number;
  repliesAfterNudge: number;
  sessionsClosedByInactivity: number;
  rateLimitedRejections: number;
}

export interface RollupDocument {
  date: string; // YYYY-MM-DD (Santiago tz), also the doc id
  generatedAtIso: string;
  schemaVersion: 1;
  groups: RollupGroup[];
}
