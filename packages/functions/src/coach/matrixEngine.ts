import { FieldValue } from "firebase-admin/firestore";
import type { EstadoMatriz, MatrixDelta } from "@salvador/shared";
import { db } from "../config/firebase.js";

// Apply a matrix delta to the current state, enforcing all spec constraints.
// Returns the new clamped state.
export function applyMatrixDelta(
  current: EstadoMatriz,
  delta: MatrixDelta,
): EstadoMatriz {
  // confianzaEnLaAyuda RESET_ZERO overrides any accumulated value
  const rawConfianza =
    delta.deltaConfianzaEnLaAyuda === "RESET_ZERO"
      ? 0
      : current.confianzaEnLaAyuda + delta.deltaConfianzaEnLaAyuda;

  const newConfianza = clamp(rawConfianza, 0, 10);

  // Rebuild derivacionAcordada — set to true when confianza crosses 7 via +2 co-construction.
  // The evaluator prompt instructs it to emit +2 only on co-construction, so we infer it here.
  const derivacionAcordada =
    current.derivacionAcordada ||
    (delta.deltaConfianzaEnLaAyuda === 2 && newConfianza >= 5);

  // intensidadEmocional floor: cannot drop below 5 unless both floor conditions are met
  const rawIntensidad = current.intensidadEmocional + delta.deltaIntensidadEmocional;
  const floorActive = !(newConfianza >= 7 && derivacionAcordada);
  const newIntensidad = floorActive
    ? clamp(rawIntensidad, 5, 10)
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

// Persist the updated matrix state to the session doc and log the delta in the turns subcollection.
export async function persistMatrixUpdate(params: {
  sessionId: string;
  turnoId: string;
  newState: EstadoMatriz;
  delta: MatrixDelta;
  latency: { personaje: number; evaluador: number; total: number };
  rol: "usuario" | "martina";
  contenido: string;
}): Promise<void> {
  const { sessionId, turnoId, newState, delta, latency, rol, contenido } = params;
  const sessionRef = db.collection("sessions").doc(sessionId);
  const turnoRef = sessionRef.collection("turnos").doc(turnoId);

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  batch.set(turnoRef, {
    rol,
    contenido,
    creadoEn: now,
    deltas: {
      intensidadEmocional: delta.deltaIntensidadEmocional,
      apertura: delta.deltaApertura,
      confianzaEnLaAyuda: delta.deltaConfianzaEnLaAyuda,
    },
    tagsObservados: delta.tagsObservados,
    antiPatronesDetectados: delta.antiPatronesDetectados,
    latenciaMs: latency,
  });

  batch.set(
    sessionRef,
    {
      estadoMatriz: newState,
      ultimaActualizacion: now,
    },
    { merge: true },
  );

  await batch.commit();
}

// Read the current matrix state from Firestore. Returns the initial state if not yet set.
export async function readMatrixState(
  sessionId: string,
  initial: EstadoMatriz,
): Promise<EstadoMatriz> {
  const snap = await db.collection("sessions").doc(sessionId).get();
  if (!snap.exists) return initial;
  const data = snap.data() as Record<string, unknown>;
  if (data["estadoMatriz"] === null || data["estadoMatriz"] === undefined) return initial;
  return data["estadoMatriz"] as EstadoMatriz;
}
