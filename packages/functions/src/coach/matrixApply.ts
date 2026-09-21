// Pure delta application. Extracted from matrixEngine.ts so scripts (Fase 2
// eval runner) can import it without pulling `config/firebase.ts` — that
// import is what triggers the vitest hang tracked in debt-0021 and it also
// forces ADC setup on any consumer.
//
// The clinical rules encoded here (floor, reset, derivacionAcordada
// inference) MUST stay in lockstep with MATRIX_EVALUATOR_ADDENDUM.

import type { EstadoMatriz, MatrixDelta } from "@salvador/shared";

export function applyMatrixDelta(
  current: EstadoMatriz,
  delta: MatrixDelta,
): EstadoMatriz {
  // confianzaEnLaAyuda RESET_ZERO overrides any accumulated value.
  const rawConfianza =
    delta.deltaConfianzaEnLaAyuda === "RESET_ZERO"
      ? 0
      : current.confianzaEnLaAyuda + delta.deltaConfianzaEnLaAyuda;

  const newConfianza = clamp(rawConfianza, 0, 10);

  // Rebuild derivacionAcordada — set to true when confianza crosses 5 via +2
  // co-construction (evaluator prompt emits +2 only on co-construction).
  const derivacionAcordada =
    current.derivacionAcordada ||
    (delta.deltaConfianzaEnLaAyuda === 2 && newConfianza >= 5);

  // intensidadEmocional floor: cannot drop below 2 while floor is active.
  // Floor lifts when confianza >= 7 AND derivacion agreed.
  const rawIntensidad = current.intensidadEmocional + delta.deltaIntensidadEmocional;
  const floorActive = !(newConfianza >= 7 && derivacionAcordada);
  const newIntensidad = floorActive
    ? clamp(rawIntensidad, 2, 10)
    : clamp(rawIntensidad, 1, 10);

  const newApertura = clamp(current.apertura + delta.deltaApertura, 1, 10);

  return {
    intensidadEmocional: newIntensidad,
    apertura: newApertura,
    confianzaEnLaAyuda: newConfianza,
    pisoIntensidadActivo: floorActive,
    derivacionAcordada,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
