import { FieldValue } from "firebase-admin/firestore";
import type { TimerState } from "@salvador/shared";
import { db } from "../config/firebase.js";
import { SESSION_DURATION_SECONDS } from "../coach/matrixConstants.js";

// Timer is continuous and real-world — no pause on inactivity per spec decision.
// See CLAUDE.md section on timer rules.

export interface TimerData {
  sesionIniciadaEn: string | null;
  cronometroAnulado: boolean;
}

// Mark the session start time on the FIRST user turn.
// Idempotent: if sesionIniciadaEn is already set, does nothing.
export async function maybeStartTimer(sessionId: string): Promise<string> {
  const sessionRef = db.collection("sessions").doc(sessionId);
  const snap = await sessionRef.get();
  const data = snap.data() as Record<string, unknown> | undefined;
  const existing = data?.["sesionIniciadaEn"];

  if (existing !== null && existing !== undefined) {
    // Already started — return the stored ISO string
    if (typeof existing === "string") return existing;
    // Firestore Timestamp — convert to ISO
    const ts = existing as { toDate(): Date };
    return ts.toDate().toISOString();
  }

  const now = new Date().toISOString();
  await sessionRef.set({ sesionIniciadaEn: now }, { merge: true });
  return now;
}

// Compute timer state from the start timestamp (server authoritative).
export function computeTimerState(
  sesionIniciadaEn: string | null,
  cronometroAnulado: boolean,
): TimerState {
  if (sesionIniciadaEn === null) {
    return {
      sesionIniciadaEn: null,
      elapsedSeconds: 0,
      remainingSeconds: SESSION_DURATION_SECONDS,
      cronometroAnulado,
    };
  }

  const startMs = new Date(sesionIniciadaEn).getTime();
  const elapsedMs = Date.now() - startMs;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const remainingSeconds = SESSION_DURATION_SECONDS - elapsedSeconds;

  return {
    sesionIniciadaEn,
    elapsedSeconds,
    remainingSeconds,
    cronometroAnulado,
  };
}

// Admin override: disable the hard cutoff for a session.
// Requires the caller to have already verified admin role.
export async function overrideTimer(sessionId: string, anular: boolean): Promise<void> {
  await db
    .collection("sessions")
    .doc(sessionId)
    .set({ cronometroAnulado: anular }, { merge: true });
}

// Check whether the session has exceeded its time limit.
// Returns false if cronometroAnulado=true (soft/advisory only).
export function isTimerExpired(timerState: TimerState): boolean {
  if (timerState.cronometroAnulado) return false;
  return timerState.remainingSeconds <= 0;
}
