import { FieldValue } from "firebase-admin/firestore";
import type { EstadoMatriz, MatrixDelta } from "@salvador/shared";
import { db } from "../config/firebase.js";
export { applyMatrixDelta } from "./matrixApply.js";

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
