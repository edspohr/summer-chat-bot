import { z } from "zod";
export const SessionStateSchema = z.enum([
    "active",
    "completed",
    "abandoned",
    "crisis_interrupted",
]);
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
});
