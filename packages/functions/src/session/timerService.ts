import { FieldValue } from "firebase-admin/firestore";
import type { TimerState } from "@salvador/shared";
import { SESSION_COMPLETE_AT_SECONDS } from "@salvador/shared";
import { db } from "../config/firebase.js";

// The session timer counts up from the first user turn. There is no hard
// cutoff — the 10-minute cap was removed in the Fase 1 sprint (2026-09-20).
// A session is considered "complete" once elapsed >= SESSION_COMPLETE_AT_SECONDS.
// The inactivity scheduler (session/inactivityScheduler.ts) is what actually
// closes sessions; the timer is display-only.

// Mark the session start time on the FIRST user turn.
// Idempotent: if sesionIniciadaEn is already set, does nothing.
export async function maybeStartTimer(sessionId: string): Promise<string> {
  const sessionRef = db.collection("sessions").doc(sessionId);
  const snap = await sessionRef.get();
  const data = snap.data() as Record<string, unknown> | undefined;
  const existing = data?.["sesionIniciadaEn"];

  if (existing !== null && existing !== undefined) {
    if (typeof existing === "string") return existing;
    const ts = existing as { toDate(): Date };
    return ts.toDate().toISOString();
  }

  const now = new Date().toISOString();
  await sessionRef.set(
    { sesionIniciadaEn: now, lastActivityAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return now;
}

// Compute timer state from the start timestamp (server authoritative).
export function computeTimerState(sesionIniciadaEn: string | null): TimerState {
  if (sesionIniciadaEn === null) {
    return { sesionIniciadaEn: null, elapsedSeconds: 0 };
  }
  const elapsedMs = Date.now() - new Date(sesionIniciadaEn).getTime();
  return {
    sesionIniciadaEn,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
  };
}

// Reporting/UX policy: is this session long enough to count as "complete"?
export function isSessionComplete(elapsedSeconds: number): boolean {
  return elapsedSeconds >= SESSION_COMPLETE_AT_SECONDS;
}
