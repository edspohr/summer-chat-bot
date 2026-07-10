// Inactivity scheduler (Phase 3, A2).
//
// Every minute, scans active sessions and:
//   1. If lastUserActivityAt is older than inactivityNudgeMs and nudgeState is
//      'none' → writes a proactive Martina message ("¿Profe, sigue ahí?"),
//      then sets nudgeState='sent'.
//   2. If lastUserActivityAt is older than inactivityCloseMs and nudgeState is
//      'sent' → closes the session with state='closed_inactivity',
//      endedReason='inactivity', nudgeState='closed'.
//
// Constraints:
//   - REGION EXCEPTION: Cloud Scheduler is NOT available in southamerica-west1
//     (where the other Cloud Functions live for Chilean data residency). We run
//     the scheduler in southamerica-east1 (São Paulo) — the closest Scheduler-
//     valid region. The compute reads/writes Firestore-Chile over the network
//     but no user data is persisted outside Chile. If Cloud Scheduler ever ships
//     in southamerica-west1, move it back — the rest of the code doesn't care.
//   - Minimum onSchedule granularity is 1 minute — nudges may fire between
//     nudgeMs and nudgeMs+60s of real inactivity. Acceptable for the workshop
//     use case (spec asks 1 min ≈ 60-119s).
//   - Uses a single scan query so cost is O(active sessions), not O(all sessions).
//   - Master flag inactivityEnabled in config/runtime; when false, the scheduler
//     wakes up and immediately exits so it stays cheap.

import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { loadRuntimeConfig } from "../config/runtimeConfig.js";
import { createSessionManager } from "./sessionManager.js";

const NUDGE_CONTENT = "¿Profe, sigue ahí?";
const NUDGE_PROMPT_VERSION = "coach_conversational_v1";

async function processSession(
  sessionId: string,
  lastUserActivityAt: Timestamp | null,
  nudgeState: string | null,
  turnCount: number,
  now: number,
  nudgeThresholdMs: number,
  closeThresholdMs: number,
): Promise<"nudged" | "closed" | "skipped"> {
  // Sessions without a first user turn yet have lastUserActivityAt=null; skip.
  if (lastUserActivityAt === null) return "skipped";

  const activityMs = lastUserActivityAt.toMillis();
  const idleMs = now - activityMs;

  if (idleMs >= closeThresholdMs && nudgeState === "sent") {
    await db.collection("sessions").doc(sessionId).update({
      state: "closed_inactivity",
      endedAt: Timestamp.fromMillis(now),
      endedReason: "inactivity",
      nudgeState: "closed",
    });
    return "closed";
  }

  if (idleMs >= nudgeThresholdMs && (nudgeState === "none" || nudgeState === null)) {
    const sessionManager = createSessionManager();
    // The nudge counts as an assistant turn. turnNumber = turnCount + 1 keeps
    // the message subcollection monotonic; the user's next reply increments
    // turnCount naturally through appendMessage.
    await sessionManager.appendMessage({
      sessionId,
      role: "assistant",
      content: NUDGE_CONTENT,
      turnNumber: turnCount + 1,
      promptVersion: NUDGE_PROMPT_VERSION,
    });
    await db.collection("sessions").doc(sessionId).update({ nudgeState: "sent" });
    return "nudged";
  }

  return "skipped";
}

export const inactivityScan = onSchedule(
  {
    schedule: "every 1 minutes",
    // NOTE region exception — see block comment above. Firestore stays in Chile.
    region: "southamerica-east1",
    timeZone: "America/Santiago",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async () => {
    const config = await loadRuntimeConfig();
    if (!config.inactivityEnabled) {
      return;
    }

    const now = Date.now();
    // Query only active sessions with a first user turn. The composite index
    // (state, lastUserActivityAt) keeps the read cheap even at scale.
    const snap = await db
      .collection("sessions")
      .where("state", "==", "active")
      .where("lastUserActivityAt", "<=", Timestamp.fromMillis(now - config.inactivityNudgeMs))
      .limit(200)
      .get();

    if (snap.empty) return;

    let nudged = 0;
    let closed = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as {
        lastUserActivityAt?: Timestamp | null;
        nudgeState?: string | null;
        turnCount?: number;
      };
      try {
        const outcome = await processSession(
          doc.id,
          data.lastUserActivityAt ?? null,
          data.nudgeState ?? null,
          typeof data.turnCount === "number" ? data.turnCount : 0,
          now,
          config.inactivityNudgeMs,
          config.inactivityCloseMs,
        );
        if (outcome === "nudged") nudged++;
        if (outcome === "closed") closed++;
      } catch (err) {
        console.error(`[INACTIVITY_SCAN] Failed on session ${doc.id}:`, err);
      }
    }

    if (nudged > 0 || closed > 0) {
      console.log(`[INACTIVITY_SCAN] nudged=${nudged} closed=${closed} scanned=${snap.size}`);
    }
  },
);
