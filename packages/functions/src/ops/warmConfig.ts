// Warm-instance schedule — single source of configuration.
//
// Code baseline is always cold: the chat-turn functions deploy with
// `minInstances` = CHAT_TURN_MIN_INSTANCES (0). During workshop hours the
// scheduled functions in warmScheduler.ts raise the Cloud Run SERVICE-level
// min instances to WARM_MIN_INSTANCES and drop it back afterwards.
// Runbook: docs/runbooks/warm-instances.md.

import { defineInt } from "firebase-functions/params";

// Revision-level baseline for the chat-turn functions. Its value lives in
// packages/functions/.env.summer-chatbot-dev so `firebase deploy` never
// prompts for it (the CLI prompts even when a default exists).
export const CHAT_TURN_MIN_INSTANCES = defineInt("CHAT_TURN_MIN_INSTANCES", {
  default: 0,
  description:
    "Revision-level min instances for coachTurn/mentorChat. Keep at 0; warming is done by the warm scheduler.",
});

// The scheduler only ever acts on this project. If the functions are deployed
// anywhere else (e.g. prod) both jobs log and exit without touching Cloud Run.
export const WARM_PROJECT_ID = "summer-chatbot-dev";

// Cloud Run region of the target services (not the scheduler's own region).
export const WARM_SERVICES_REGION = "southamerica-west1";

// Cloud Run service names (lowercased function names) on the user-facing
// chat-turn path. Only these are eligible for warming.
export const WARM_TARGET_SERVICES: readonly string[] = ["coachturn", "mentorchat"];

export const WARM_MIN_INSTANCES = 1;
export const COLD_MIN_INSTANCES = 0;

export const WARM_TIME_ZONE = "America/Santiago";
// Cron in WARM_TIME_ZONE. Cloud Scheduler resolves the zone, so the jobs stay
// at 09:00/18:00 local time across DST changes.
export const WARM_UP_SCHEDULE = "0 9 * * 1-5";
export const COOL_DOWN_SCHEDULE = "0 18 * * 1-5";

// Chilean national public holidays, YYYY-MM-DD in America/Santiago.
// The 09:00 job does nothing on these dates; the 18:00 job always runs.
// MUST be refreshed once a year (see runbook). Regional holidays and
// election days are not included.
export const CHILE_HOLIDAYS: readonly string[] = [
  // 2026 (October onwards)
  "2026-10-12", // Encuentro de Dos Mundos
  "2026-10-31", // Día de las Iglesias Evangélicas y Protestantes (Saturday)
  "2026-11-01", // Día de Todos los Santos (Sunday)
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
  // 2027
  "2027-01-01", // Año Nuevo
  "2027-03-26", // Viernes Santo
  "2027-03-27", // Sábado Santo (Saturday)
  "2027-05-01", // Día del Trabajo (Saturday)
  "2027-05-21", // Día de las Glorias Navales
  "2027-06-21", // Día Nacional de los Pueblos Indígenas (winter solstice)
  "2027-06-28", // San Pedro y San Pablo (moved from Tuesday 29)
  "2027-07-16", // Virgen del Carmen
  "2027-08-15", // Asunción de la Virgen (Sunday)
  "2027-09-17", // Feriado adicional de Fiestas Patrias (18 falls on Saturday)
  "2027-09-18", // Independencia Nacional (Saturday)
  "2027-09-19", // Glorias del Ejército (Sunday)
  "2027-10-11", // Encuentro de Dos Mundos (moved from Tuesday 12)
  "2027-10-31", // Día de las Iglesias Evangélicas y Protestantes (Sunday)
  "2027-11-01", // Día de Todos los Santos
  "2027-12-08", // Inmaculada Concepción
  "2027-12-25", // Navidad (Saturday)
];

// Last date the list above covers. After it the 09:00 job still warms but
// logs a warning on every run so the stale list gets noticed.
export const CHILE_HOLIDAYS_COVERED_UNTIL = "2027-12-31";
