// 8.8 Unreal booth — live aggregate for the /8dot8 TV dashboard.
//
// Writes a single PUBLICLY READABLE doc (event_live/8dot8). It must only ever
// contain counters, averages and bare epoch-ms timestamps — never session ids,
// user ids or text. Full recompute over event sessions on every call: cheap at
// the expected volume (a few hundred sessions) and trivially idempotent.
//
// Called by:
//   - eventLiveOnSessionWrite (Firestore trigger on sessions/{id})
//   - eventLiveTick (1-min scheduler: catches tag writes that land after the
//     session write, and fixes any drift)
//   - scripts/backfill-event-8dot8.ts (manual recompute)

import { Timestamp } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  EVENT_8DOT8,
  OASIS_PHASES_IN_ORDER,
  phaseFromTagId,
  type EventLiveDoc,
  type OasisPhase,
} from "@salvador/shared";
import { db } from "../config/firebase.js";
import { dwellSeconds } from "./aggregators.js";

const EVENT_START_MS = Date.parse(EVENT_8DOT8.startIso);
const EVENT_END_MS = Date.parse(EVENT_8DOT8.endIso);
const RECENT_WINDOW_MS = 10 * 60_000;
const RECENT_MAX = 50;
const CLOSED_STATES = new Set(["closed_completed", "closed_inactivity", "completed"]);

interface EventSessionDoc {
  source?: string;
  state?: string;
  startedAt?: Timestamp;
  lastActivityAt?: Timestamp;
  sesionIniciadaEn?: string | null;
  lastUserActivityAt?: Timestamp | null;
  estadoMatriz?: {
    intensidadEmocional?: number;
    apertura?: number;
    confianzaEnLaAyuda?: number;
  } | null;
}

function emptyPhasePct(): Record<OasisPhase, number> {
  const out = {} as Record<OasisPhase, number>;
  for (const p of OASIS_PHASES_IN_ORDER) out[p] = 0;
  return out;
}

// sessionId → set of phases with ≥1 completed tag, plus total completed tags.
async function loadCompletedTags(sessionIds: string[]): Promise<{
  phasesBySession: Map<string, Set<OasisPhase>>;
  total: number;
}> {
  const phasesBySession = new Map<string, Set<OasisPhase>>();
  let total = 0;
  for (let i = 0; i < sessionIds.length; i += 30) {
    const chunk = sessionIds.slice(i, i + 30);
    const snap = await db
      .collection("tag_progress")
      .where("sessionId", "in", chunk)
      .where("completed", "==", true)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data() as { sessionId?: string; tagId?: string };
      if (typeof data.sessionId !== "string" || typeof data.tagId !== "string") continue;
      total++;
      const phase = phaseFromTagId(data.tagId);
      if (phase === null) continue;
      const set = phasesBySession.get(data.sessionId) ?? new Set<OasisPhase>();
      set.add(phase);
      phasesBySession.set(data.sessionId, set);
    }
  }
  return { phasesBySession, total };
}

export async function computeEventLive(nowMs: number = Date.now()): Promise<EventLiveDoc> {
  // Equality-only query (single-field index); window filtered in memory so no
  // composite index is needed.
  const snap = await db.collection("sessions").where("source", "==", EVENT_8DOT8.source).get();
  const sessions = snap.docs
    .map((d) => ({ id: d.id, data: d.data() as EventSessionDoc }))
    .filter(({ data }) => {
      const ms = data.startedAt?.toMillis();
      return ms !== undefined && ms >= EVENT_START_MS && ms <= EVENT_END_MS;
    });

  const { phasesBySession, total: oasisTags } = await loadCompletedTags(sessions.map((s) => s.id));

  let listenSeconds = 0;
  const recentActivity: number[] = [];
  const matrixSum = { intensidadEmocional: 0, apertura: 0, confianzaEnLaAyuda: 0, n: 0 };
  const phaseHits = emptyPhasePct();

  for (const { id, data } of sessions) {
    const start =
      typeof data.sesionIniciadaEn === "string" && data.sesionIniciadaEn.length > 0
        ? Timestamp.fromDate(new Date(data.sesionIniciadaEn))
        : null;
    const dwell = dwellSeconds({
      sesionIniciadaEn: start,
      lastUserActivityAt: data.lastUserActivityAt ?? null,
      lastActivityAt: data.lastActivityAt ?? null,
    });
    if (dwell !== null) listenSeconds += dwell.seconds;

    const lastUserMs = data.lastUserActivityAt?.toMillis();
    if (lastUserMs !== undefined && nowMs - lastUserMs <= RECENT_WINDOW_MS && data.state === "active") {
      recentActivity.push(lastUserMs);
    }

    const m = data.estadoMatriz;
    if (
      data.state !== undefined &&
      CLOSED_STATES.has(data.state) &&
      m !== null &&
      m !== undefined &&
      typeof m.intensidadEmocional === "number" &&
      typeof m.apertura === "number" &&
      typeof m.confianzaEnLaAyuda === "number"
    ) {
      matrixSum.intensidadEmocional += m.intensidadEmocional;
      matrixSum.apertura += m.apertura;
      matrixSum.confianzaEnLaAyuda += m.confianzaEnLaAyuda;
      matrixSum.n++;
    }

    for (const phase of phasesBySession.get(id) ?? []) phaseHits[phase]++;
  }

  const phaseSessionPct = emptyPhasePct();
  if (sessions.length > 0) {
    for (const p of OASIS_PHASES_IN_ORDER) {
      phaseSessionPct[p] = Math.round((phaseHits[p] / sessions.length) * 100);
    }
  }

  const round1 = (x: number): number => Math.round(x * 10) / 10;

  return {
    sessions: sessions.length,
    listenSeconds: Math.round(listenSeconds),
    oasisTags,
    phaseSessionPct,
    matrixFinalAvg:
      matrixSum.n === 0
        ? null
        : {
            intensidadEmocional: round1(matrixSum.intensidadEmocional / matrixSum.n),
            apertura: round1(matrixSum.apertura / matrixSum.n),
            confianzaEnLaAyuda: round1(matrixSum.confianzaEnLaAyuda / matrixSum.n),
            n: matrixSum.n,
          },
    recentActivity: recentActivity.sort((a, b) => b - a).slice(0, RECENT_MAX),
    updatedAtMs: nowMs,
  };
}

export async function recomputeEventLive(): Promise<EventLiveDoc> {
  const doc = await computeEventLive();
  await db.collection(EVENT_8DOT8.liveCollection).doc(EVENT_8DOT8.liveDocId).set(doc);
  return doc;
}

export const eventLiveOnSessionWrite = onDocumentWritten(
  { document: "sessions/{sessionId}", region: "southamerica-west1" },
  async (event) => {
    const before = event.data?.before.data() as EventSessionDoc | undefined;
    const after = event.data?.after.data() as EventSessionDoc | undefined;
    if (before?.source !== EVENT_8DOT8.source && after?.source !== EVENT_8DOT8.source) return;
    try {
      await recomputeEventLive();
    } catch (err) {
      // No session content here — only the error message.
      console.error("[eventLive] recompute failed", err instanceof Error ? err.message : String(err));
    }
  },
);

export const eventLiveTick = onSchedule(
  {
    schedule: "every 1 minutes",
    // Cloud Scheduler is not offered in southamerica-west1 — same exception as
    // analyticsRollupDaily (ADR-001 amendment). Firestore data stays in Chile.
    region: "southamerica-east1",
    timeZone: "America/Santiago",
  },
  async () => {
    const now = Date.now();
    // Keep ticking an hour past the window so the last sessions settle.
    if (now < EVENT_START_MS || now > EVENT_END_MS + 3600_000) return;
    await recomputeEventLive();
  },
);
