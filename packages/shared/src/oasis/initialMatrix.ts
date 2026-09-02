// Canonical initial emotional-matrix state for each scenario.
//
// The engine's runtime source of truth: `readMatrixState(sessionId, initial)`
// in packages/functions/src/coach/matrixEngine.ts falls back to this value
// when a session's `estadoMatriz` field is null/absent. Everything else that
// displays an "initial" value (Session Report, Coach UI bars, Lab prompt
// scaffold, closing-data export) MUST read from this map so no consumer
// disagrees with the engine.
//
// See debt/0022 for the follow-up: teach the engine to read scenario-specific
// initials from the scenario document, so this hard-coded map can go away
// when scenario_02 (Matías) lands.

import type { EstadoMatriz } from "../schemas/session.schema.js";

// Martina (scenario_03) — piso active + no derivación agreed at t=0.
export const MARTINA_INITIAL_MATRIX: EstadoMatriz = {
  intensidadEmocional: 6,
  apertura: 5,
  confianzaEnLaAyuda: 4,
  pisoIntensidadActivo: true,
  derivacionAcordada: false,
};

export const INITIAL_MATRIX_BY_SCENARIO: Record<string, EstadoMatriz> = {
  scenario_03_martina: MARTINA_INITIAL_MATRIX,
};

// Returns the canonical initial matrix for a scenario, or null when the
// scenario is not registered. Callers on the trainee-visible path should
// fall back to `MARTINA_INITIAL_MATRIX` (the engine's own default) rather
// than crash — see coachHandler.ts:231 which passes the constant directly.
export function initialMatrixFor(scenarioId: string): EstadoMatriz | null {
  return INITIAL_MATRIX_BY_SCENARIO[scenarioId] ?? null;
}
