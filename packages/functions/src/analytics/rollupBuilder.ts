// Builds an analytics_rollups doc for a given calendar day (Santiago tz).
// Called by:
//   - The daily scheduler (Phase 6 A) — computes yesterday's rollup at 04:00.
//   - The backfill script (Phase 6 B) — runs one day at a time for historical
//     dates (workshop 2026-06-17 etc.).
//
// This module OWNS the reads. The pure aggregation helpers in aggregators.ts
// do the math; this module gathers the Firestore inputs.

import { Timestamp } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import type { RollupDocument, RollupGroup } from "@salvador/shared";
import { SESSION_COMPLETE_AT_SECONDS } from "@salvador/shared";
import {
  bucketEndState,
  computeDwellStats,
  computeTurnStats,
  dwellSeconds,
  emptyGroup,
  groupKey,
  matrixMoved,
  median,
  santiagoDayWindow,
} from "./aggregators.js";

// Firestore-shape of a session doc as seen by the rollup. Only the fields we
// need — the actual doc has many more.
interface SessionDoc {
  userId?: string;
  scenarioId?: string;
  cohortCode?: string | null;
  state?: string;
  startedAt?: Timestamp;
  lastActivityAt?: Timestamp;
  // MED-01: first user turn (ISO string, written by timerService.startTimer)
  // and last user turn (Timestamp, written by session.updateLastUserActivity).
  sesionIniciadaEn?: string | null;
  lastUserActivityAt?: Timestamp | null;
  endedAt?: Timestamp | null;
  turnCount?: number;
  crisisBranch?: string | null;
  estadoMatriz?: {
    intensidadEmocional?: number;
    apertura?: number;
    confianzaEnLaAyuda?: number;
  } | null;
}

async function loadSessionsForDay(startMs: number, endMs: number): Promise<Array<{ id: string; data: SessionDoc }>> {
  // We want sessions that STARTED within the day. Using startedAt as the
  // partition key keeps the semantics simple: a rollup for 2026-07-10 counts
  // everything that started that day, regardless of when it ended.
  const snap = await db
    .collection("sessions")
    .where("startedAt", ">=", Timestamp.fromMillis(startMs))
    .where("startedAt", "<", Timestamp.fromMillis(endMs))
    .get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as SessionDoc }));
}

// For each session, count the tags awarded (completed=true in tag_progress).
async function countTagsForSession(sessionId: string): Promise<number> {
  const snap = await db
    .collection("tag_progress")
    .where("sessionId", "==", sessionId)
    .where("completed", "==", true)
    .get();
  return snap.size;
}

interface MessageAggregates {
  safeguardActivations: number;
  nudgesSent: number;
  repliesAfterNudge: number;
  // MED-01: timestamp of the last message with role === "user" in this
  // session, used as the dwell fallback when `lastUserActivityAt` is missing
  // on the session doc (historical rows).
  lastUserMessageAt: Timestamp | null;
}

// Scans a session's messages once and returns the counts we need. Doing all
// three from a single collection read keeps rollup cost bounded.
async function messageAggregatesForSession(sessionId: string): Promise<MessageAggregates> {
  const snap = await db
    .collection("sessions")
    .doc(sessionId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get();

  let safeguardActivations = 0;
  let nudgesSent = 0;
  let repliesAfterNudge = 0;
  let lastWasNudge = false;
  let lastUserMessageAt: Timestamp | null = null;

  for (const doc of snap.docs) {
    const data = doc.data() as {
      role?: string;
      safetyLayerTriggered?: string;
      createdAt?: Timestamp;
      meta?: { isNudge?: boolean };
    };
    if (typeof data.safetyLayerTriggered === "string") safeguardActivations++;
    if (data.meta?.isNudge === true) {
      nudgesSent++;
      lastWasNudge = true;
    } else if (data.role === "user" && lastWasNudge) {
      repliesAfterNudge++;
      lastWasNudge = false;
    } else if (data.role === "user") {
      lastWasNudge = false;
    }
    if (data.role === "user" && data.createdAt !== undefined) {
      lastUserMessageAt = data.createdAt;
    }
  }

  return { safeguardActivations, nudgesSent, repliesAfterNudge, lastUserMessageAt };
}

// Track unique-device counts per group. Building this in a Set keeps it O(1)
// per session; we serialize to counts at the end.
type GroupAccumulator = {
  group: RollupGroup;
  devices: Set<string>;
  dwellSecondsList: number[];
  // MED-01: parallel to dwellSecondsList — how each dwell value was derived.
  dwellFallbackCount: number;
  dwellNoStartCount: number;
  turnCountsList: number[];
  tagCountsList: number[];
};

export async function buildRollupForDate(dateStr: string): Promise<RollupDocument> {
  const { startMs, endMs } = santiagoDayWindow(dateStr);
  const sessions = await loadSessionsForDay(startMs, endMs);

  const accs = new Map<string, GroupAccumulator>();
  const getAcc = (scenarioId: string, cohortCode: string | null): GroupAccumulator => {
    const k = groupKey(scenarioId, cohortCode);
    let existing = accs.get(k);
    if (existing === undefined) {
      existing = {
        group: emptyGroup(scenarioId, cohortCode),
        devices: new Set(),
        dwellSecondsList: [],
        dwellFallbackCount: 0,
        dwellNoStartCount: 0,
        turnCountsList: [],
        tagCountsList: [],
      };
      accs.set(k, existing);
    }
    return existing;
  };

  // Sequential per-session — reads are IO-bound, and Firestore admin SDK
  // parallelizes internally. Batching to Promise.all would spike concurrency
  // and hit the daily quota if we ever grow past ~200 sessions/day.
  for (const { id, data } of sessions) {
    const scenarioId = data.scenarioId ?? "__unknown";
    const cohortCode = data.cohortCode ?? null;
    const acc = getAcc(scenarioId, cohortCode);

    acc.group.sessionsStarted += 1;
    if (typeof data.userId === "string" && data.userId.length > 0) {
      acc.devices.add(data.userId);
    }

    const endBucket = bucketEndState(data.state);
    if (endBucket !== "active") {
      acc.group.ended[endBucket] += 1;
    }

    if (typeof data.turnCount === "number") acc.turnCountsList.push(data.turnCount);

    if (matrixMoved(data.estadoMatriz ?? null)) acc.group.matrixMovedSessions += 1;

    // Crisis breakdown
    if (data.state === "crisis_interrupted") {
      if (data.crisisBranch === "crisis_exercise") acc.group.crisis.crisisExercise += 1;
      else if (data.crisisBranch === "crisis_flagged_real") acc.group.crisis.crisisFlaggedReal += 1;
      else acc.group.crisis.crisisUnbranched += 1;
    }

    if (data.state === "closed_inactivity") acc.group.sessionsClosedByInactivity += 1;

    // Per-session message + tag reads. Parallelizing the pair per session is
    // fine — no cross-session dependency.
    const [tags, msgAgg] = await Promise.all([
      countTagsForSession(id),
      messageAggregatesForSession(id),
    ]);
    acc.tagCountsList.push(tags);
    acc.group.tagsAwardedTotal += tags;
    acc.group.crisis.safeguardActivations += msgAgg.safeguardActivations;
    acc.group.nudgesSent += msgAgg.nudgesSent;
    acc.group.repliesAfterNudge += msgAgg.repliesAfterNudge;

    // MED-01: dwell time from first→last user turn. `sesionIniciadaEn` is
    // written as an ISO string by timerService; convert to Timestamp so
    // dwellSeconds() can use the same math as the other timestamp inputs.
    // Sessions without a first user turn are counted separately and excluded
    // from percentile stats.
    const sesionIniciadaAt =
      typeof data.sesionIniciadaEn === "string" && data.sesionIniciadaEn.length > 0
        ? Timestamp.fromDate(new Date(data.sesionIniciadaEn))
        : null;
    const dwell = dwellSeconds({
      sesionIniciadaEn: sesionIniciadaAt,
      lastUserActivityAt: data.lastUserActivityAt ?? null,
      lastUserMessageAt: msgAgg.lastUserMessageAt,
      lastActivityAt: data.lastActivityAt ?? null,
    });
    if (dwell === null) {
      if (sesionIniciadaAt === null) acc.dwellNoStartCount += 1;
    } else {
      acc.dwellSecondsList.push(dwell.seconds);
      if (dwell.source === "fallback") acc.dwellFallbackCount += 1;
      if (dwell.seconds >= SESSION_COMPLETE_AT_SECONDS) acc.group.sessionsComplete += 1;
    }
  }

  // Finalize each group — compute medians/rates now that all sessions are in.
  const groups: RollupGroup[] = [];
  for (const [, acc] of accs) {
    acc.group.uniqueDevices = acc.devices.size;
    acc.group.dwell = computeDwellStats(acc.dwellSecondsList, {
      fallbackCount: acc.dwellFallbackCount,
      noStartCount: acc.dwellNoStartCount,
    });
    acc.group.turns = computeTurnStats(acc.turnCountsList);
    acc.group.tagsPerSessionMedian = Math.round(median(acc.tagCountsList));
    acc.group.matrixMovementRate =
      acc.group.sessionsStarted === 0
        ? 0
        : Math.round((acc.group.matrixMovedSessions / acc.group.sessionsStarted) * 100) / 100;
    groups.push(acc.group);
  }

  // Stable order — cohort ASC then scenario ASC. Empty cohort comes last.
  groups.sort((a, b) => {
    const cohortCmp = (a.cohortCode ?? "￿").localeCompare(b.cohortCode ?? "￿");
    if (cohortCmp !== 0) return cohortCmp;
    return a.scenarioId.localeCompare(b.scenarioId);
  });

  return {
    date: dateStr,
    generatedAtIso: new Date().toISOString(),
    schemaVersion: 1,
    groups,
  };
}

export async function writeRollup(rollup: RollupDocument): Promise<void> {
  await db.collection("analytics_rollups").doc(rollup.date).set(rollup);
}

export async function buildAndWriteRollupForDate(
  dateStr: string,
): Promise<{ groups: number; sessions: number; dwellFallback: number; dwellNoStart: number }> {
  const rollup = await buildRollupForDate(dateStr);
  await writeRollup(rollup);
  return {
    groups: rollup.groups.length,
    sessions: rollup.groups.reduce((sum, g) => sum + g.sessionsStarted, 0),
    dwellFallback: rollup.groups.reduce((sum, g) => sum + (g.dwell.fallbackCount ?? 0), 0),
    dwellNoStart: rollup.groups.reduce((sum, g) => sum + (g.dwell.noStartCount ?? 0), 0),
  };
}
