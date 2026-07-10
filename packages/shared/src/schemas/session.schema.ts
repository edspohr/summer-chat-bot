import { z } from "zod";

// State machine:
//   active → closed_completed  (user ended the session or timer expired)
//         → closed_inactivity  (inactivity scheduler closed after nudge timeout, Phase 3)
//         → abandoned          (client dropped without close signal)
//         → crisis_interrupted (safety pipeline paused the session)
// Legacy value "completed" is still accepted for sessions created before Phase 2
// so existing Firestore data keeps parsing. New writes use closed_completed.
export const SessionStateSchema = z.enum([
  "active",
  "completed",
  "closed_completed",
  "closed_inactivity",
  "abandoned",
  "crisis_interrupted",
]);

// Reason a session moved to a terminal state. Free-form for future extension;
// current known values: "user_ended", "timer_expired", "inactivity", "crisis".
export const SessionEndedReasonSchema = z.string();

// Nudge state for the Phase 3 inactivity scheduler. Reserved in Phase 2.
export const NudgeStateSchema = z.enum(["none", "sent", "closed"]);

// Crisis branch chosen by the trainee after safety pipeline flagged. Reserved in
// Phase 2, populated in Phase 4 (A7 crisis UX).
export const CrisisBranchSchema = z.enum(["crisis_exercise", "crisis_flagged_real"]);

export const SessionModeSchema = z.enum(["mentor", "coach"]);

// Simulation mode — "escenario" runs full Martina scenario; "promptPuro" bypasses persona
export const SimulationModeSchema = z.enum(["escenario", "promptPuro"]);

// Firestore Timestamp is not typed here to avoid firebase-admin dependency in shared.
// Consumers must cast to FirebaseFirestore.Timestamp after reading from Firestore.
const TimestampSchema = z.unknown();

// The authoritative emotional matrix state stored per session
export const EstadoMatrizSchema = z.object({
  intensidadEmocional: z.number().min(1).max(10),
  apertura: z.number().min(1).max(10),
  confianzaEnLaAyuda: z.number().min(0).max(10),
  pisoIntensidadActivo: z.boolean(),
  derivacionAcordada: z.boolean(),
});

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  scenarioId: z.string(),
  mode: SessionModeSchema,
  // Simulation sub-mode: "escenario" (Martina full scenario) or "promptPuro" (base model only)
  modo: SimulationModeSchema.default("escenario"),
  state: SessionStateSchema,
  promptVersion: z.string(),
  turnCount: z.number().int().nonnegative(),
  // Set on the first user turn (ISO-8601 UTC string or Firestore Timestamp)
  sesionIniciadaEn: TimestampSchema.nullable().default(null),
  // Admin override: when true, the 10-min hard cutoff is disabled
  cronometroAnulado: z.boolean().default(false),
  // Authoritative matrix state — null in promptPuro mode
  estadoMatriz: EstadoMatrizSchema.nullable().default(null),
  ultimaActualizacion: TimestampSchema.optional(),
  startedAt: TimestampSchema,
  lastActivityAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
  // Phase 2 additions (all default null so existing sessions keep parsing):
  // canonical end timestamp — written when the session moves to any closed_* state
  endedAt: TimestampSchema.nullable().default(null),
  endedReason: SessionEndedReasonSchema.nullable().default(null),
  // Non-personal grouping key captured from the entry URL (?c=...). Enables Part B
  // dashboard grouping by workshop/venue/date without any PII.
  cohortCode: z.string().nullable().default(null),
  // Timestamp of the last USER turn — feeds the Phase 3 inactivity scheduler.
  // Distinct from lastActivityAt which also moves on assistant turns.
  lastUserActivityAt: TimestampSchema.nullable().default(null),
  // Idempotency guard for the Phase 3 inactivity nudge cycle.
  nudgeState: NudgeStateSchema.nullable().default(null),
  // Branch chosen by trainee after safety pipeline flagged (Phase 4).
  crisisBranch: CrisisBranchSchema.nullable().default(null),
});

export type SessionState = z.infer<typeof SessionStateSchema>;
export type SessionMode = z.infer<typeof SessionModeSchema>;
export type SimulationMode = z.infer<typeof SimulationModeSchema>;
export type EstadoMatriz = z.infer<typeof EstadoMatrizSchema>;
export type NudgeState = z.infer<typeof NudgeStateSchema>;
export type CrisisBranch = z.infer<typeof CrisisBranchSchema>;
export type Session = z.infer<typeof SessionSchema>;
