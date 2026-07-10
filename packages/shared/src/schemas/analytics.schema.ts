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
