import { FieldValue } from "firebase-admin/firestore";
import type { Session, Message, SessionState, EvaluatorRawOutput } from "@salvador/shared";
import { SessionSchema, MessageSchema } from "@salvador/shared";
import { db } from "../config/firebase.js";

export interface SessionManagerService {
  createSession(params: {
    sessionId: string;
    userId: string;
    scenarioId: string;
    mode: "mentor" | "coach";
    promptVersion: string;
    cohortCode?: string | null;
  }): Promise<void>;

  getSession(sessionId: string): Promise<Session | null>;

  getHistory(sessionId: string, lastN: number): Promise<Message[]>;

  appendMessage(params: {
    sessionId: string;
    role: "user" | "assistant";
    content: string;
    turnNumber: number;
    evaluatorOutput?: EvaluatorRawOutput;
    safetyLayerTriggered?: "L1" | "L2" | "L3";
    promptVersion: string;
  }): Promise<void>;

  updateState(sessionId: string, state: SessionState): Promise<void>;

  completeSession(sessionId: string): Promise<void>;

  markCrisisInterrupted(sessionId: string): Promise<void>;

  canResume(sessionId: string): Promise<{ canResume: boolean; reason: string }>;

  // Phase 3 — updates lastUserActivityAt and resets nudgeState to 'none'.
  // Called on every user turn so the inactivity scheduler restarts its window.
  updateLastUserActivity(sessionId: string): Promise<void>;
}

export function createSessionManager(): SessionManagerService {
  const sessions = db.collection("sessions");

  return {
    async createSession({ sessionId, userId, scenarioId, mode, promptVersion, cohortCode }) {
      const docRef = sessions.doc(sessionId);
      const snap = await docRef.get();
      if (snap.exists) return;
      await docRef.set({
        userId,
        scenarioId,
        mode,
        state: "active",
        promptVersion,
        turnCount: 0,
        startedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
        // Phase 2 fields — inert until later phases consume them.
        cohortCode: cohortCode ?? null,
        endedAt: null,
        endedReason: null,
        lastUserActivityAt: null,
        nudgeState: "none",
        crisisBranch: null,
      });
    },

    async getSession(sessionId) {
      const snap = await sessions.doc(sessionId).get();
      if (!snap.exists) return null;
      const parsed = SessionSchema.safeParse({ id: snap.id, ...snap.data() });
      if (!parsed.success) {
        console.error(`[SESSION] Session ${sessionId} failed schema validation`, parsed.error.flatten());
        return null;
      }
      return parsed.data;
    },

    async getHistory(sessionId, lastN) {
      const snaps = await sessions
        .doc(sessionId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .limitToLast(lastN)
        .get();

      const messages: Message[] = [];
      for (const snap of snaps.docs) {
        const parsed = MessageSchema.safeParse(snap.data());
        if (parsed.success) {
          messages.push(parsed.data);
        } else {
          console.error(`[SESSION] Message ${snap.id} failed schema validation`, parsed.error.flatten());
        }
      }
      return messages;
    },

    async appendMessage({ sessionId, role, content, turnNumber, evaluatorOutput, safetyLayerTriggered, promptVersion }) {
      const sessionRef = sessions.doc(sessionId);
      const msgRef = sessionRef.collection("messages").doc();

      const msgData: Record<string, unknown> = {
        sessionId,
        role,
        content,
        turnNumber,
        promptVersion,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (evaluatorOutput !== undefined) msgData["evaluatorOutput"] = evaluatorOutput;
      if (safetyLayerTriggered !== undefined) msgData["safetyLayerTriggered"] = safetyLayerTriggered;

      const batch = db.batch();
      batch.set(msgRef, msgData);
      // merge: true so this doesn't fail if the session doc was somehow missing
      batch.set(
        sessionRef,
        { turnCount: turnNumber, lastActivityAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      await batch.commit();
    },

    async updateState(sessionId, state) {
      await sessions.doc(sessionId).update({ state });
    },

    async completeSession(sessionId) {
      const now = FieldValue.serverTimestamp();
      await sessions.doc(sessionId).update({
        state: "closed_completed",
        completedAt: now,
        endedAt: now,
        endedReason: "user_ended",
      });
    },

    async markCrisisInterrupted(sessionId) {
      await sessions.doc(sessionId).update({ state: "crisis_interrupted" });
    },

    async updateLastUserActivity(sessionId) {
      await sessions.doc(sessionId).update({
        lastUserActivityAt: FieldValue.serverTimestamp(),
        nudgeState: "none",
      });
    },

    async canResume(sessionId) {
      const snap = await sessions.doc(sessionId).get();
      if (!snap.exists) {
        return { canResume: false, reason: "Session not found" };
      }
      const state = (snap.data() as { state?: string }).state;
      if (state === "crisis_interrupted") {
        return {
          canResume: false,
          reason: "Session was crisis-interrupted. Explicit confirmation required before resuming.",
        };
      }
      if (
        state === "completed" ||
        state === "closed_completed" ||
        state === "closed_inactivity" ||
        state === "abandoned"
      ) {
        return { canResume: false, reason: `Session is ${state}` };
      }
      return { canResume: true, reason: "Session is active" };
    },
  };
}
