// Closing-data export for the Sprint 0 pilot presentation.
//
// Reads raw sessions from Firestore and writes two files under
// packages/functions/exports/ (gitignored):
//   - sessions.csv : one row per session (session-level fields only, never
//                    message text; no PII beyond anonymous auth uids).
//   - summary.json : totals + monthly breakdown for the presentation deck.
//
// The summary is also printed to stdout so it can be pasted directly.
//
// Usage (local, with a service account key):
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
//   export GCLOUD_PROJECT=summer-chatbot-dev
//   pnpm --filter @salvador/functions export:pilot
//   pnpm --filter @salvador/functions export:pilot -- --from 2026-07-01 --to 2026-09-02
//
// Column notes:
//   - `mode`      is the session's `modo` field ("escenario" | "promptPuro").
//                 Renamed on export for readability; the underlying field is Spanish.
//   - `cohortCode` is the workshop / cohort tag captured from the entry URL (?c=...).
//                 There is no separate `eventId` field on the session doc.

import { promises as fs } from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { INITIAL_ESTADO_MATRIZ } from "../src/coach/matrixConstants.js";
import { dwellSeconds } from "../src/analytics/aggregators.js";
import { OASIS_PHASES_IN_ORDER, phaseFromTagId, type OasisPhase } from "@salvador/shared";

if (!process.env["GCLOUD_PROJECT"] && !process.env["GOOGLE_CLOUD_PROJECT"]) {
  console.error("Set GCLOUD_PROJECT (or GOOGLE_CLOUD_PROJECT) before running.");
  process.exit(1);
}
if (!process.env["GOOGLE_APPLICATION_CREDENTIALS"]) {
  console.error(
    "Set GOOGLE_APPLICATION_CREDENTIALS to the path of a service account JSON key.",
  );
  process.exit(1);
}

initializeApp();
const db = getFirestore();

// ── CLI ────────────────────────────────────────────────────────────────────

interface Args {
  from: string | null;
  to: string | null;
  outDir: string;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2).filter((a) => a !== "--");
  let from: string | null = null;
  let to: string | null = null;
  const outDir = path.resolve(process.cwd(), "exports");
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from" && args[i + 1] !== undefined) {
      from = args[i + 1] ?? null;
      i++;
    } else if (a === "--to" && args[i + 1] !== undefined) {
      to = args[i + 1] ?? null;
      i++;
    }
  }
  return { from, to, outDir };
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface SessionRow {
  sessionId: string;
  scenarioId: string;
  mode: string;
  startedAtIso: string;
  sesionIniciadaEnIso: string;
  lastUserActivityAtIso: string;
  dwellMinutes: string; // number or ""
  dwellSource: string; // "user_activity" | "fallback" | ""
  userTurns: number;
  matchedTags: number;
  totalTags: number;
  achievementPct: number;
  intensidadEmocional_initial: number;
  intensidadEmocional_final: string; // number or ""
  intensidadEmocional_delta: string;
  apertura_initial: number;
  apertura_final: string;
  apertura_delta: string;
  confianzaEnLaAyuda_initial: number;
  confianzaEnLaAyuda_final: string;
  confianzaEnLaAyuda_delta: string;
  safetyTriggered: boolean;
  cohortCode: string;
}

const CSV_COLUMNS: Array<keyof SessionRow> = [
  "sessionId",
  "scenarioId",
  "mode",
  "startedAtIso",
  "sesionIniciadaEnIso",
  "lastUserActivityAtIso",
  "dwellMinutes",
  "dwellSource",
  "userTurns",
  "matchedTags",
  "totalTags",
  "achievementPct",
  "intensidadEmocional_initial",
  "intensidadEmocional_final",
  "intensidadEmocional_delta",
  "apertura_initial",
  "apertura_final",
  "apertura_delta",
  "confianzaEnLaAyuda_initial",
  "confianzaEnLaAyuda_final",
  "confianzaEnLaAyuda_delta",
  "safetyTriggered",
  "cohortCode",
];

function csvEscape(v: string | number | boolean): string {
  const s = String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toIso(t: Timestamp | null | undefined | string): string {
  if (t === null || t === undefined) return "";
  if (typeof t === "string") return t;
  return t.toDate().toISOString();
}

function toTimestamp(t: unknown): Timestamp | null {
  if (t === null || t === undefined) return null;
  if (t instanceof Timestamp) return t;
  if (typeof t === "string" && t.length > 0) {
    const ms = Date.parse(t);
    if (Number.isNaN(ms)) return null;
    return Timestamp.fromMillis(ms);
  }
  return null;
}

async function totalTagsForScenario(scenarioId: string, cache: Map<string, number>): Promise<number> {
  const cached = cache.get(scenarioId);
  if (cached !== undefined) return cached;
  const snap = await db.collection("scenarios").doc(scenarioId).get();
  const data = snap.data() as { requiredTags?: Array<unknown> } | undefined;
  const n = Array.isArray(data?.requiredTags) ? data.requiredTags.length : 0;
  cache.set(scenarioId, n);
  return n;
}

interface SessionMessageCounts {
  userTurns: number;
  safetyTriggered: boolean;
  lastUserMessageAt: Timestamp | null;
}

async function scanMessages(sessionId: string): Promise<SessionMessageCounts> {
  const snap = await db
    .collection("sessions")
    .doc(sessionId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get();
  let userTurns = 0;
  let safetyTriggered = false;
  let lastUserMessageAt: Timestamp | null = null;
  for (const doc of snap.docs) {
    const d = doc.data() as {
      role?: string;
      safetyLayerTriggered?: string;
      createdAt?: Timestamp;
      meta?: { isNudge?: boolean };
    };
    if (typeof d.safetyLayerTriggered === "string") safetyTriggered = true;
    if (d.role === "user" && d.meta?.isNudge !== true) {
      userTurns++;
      if (d.createdAt !== undefined) lastUserMessageAt = d.createdAt;
    }
  }
  return { userTurns, safetyTriggered, lastUserMessageAt };
}

async function matchedTagsForSession(sessionId: string): Promise<Set<string>> {
  const snap = await db
    .collection("tag_progress")
    .where("sessionId", "==", sessionId)
    .where("completed", "==", true)
    .get();
  const ids = new Set<string>();
  for (const doc of snap.docs) {
    const d = doc.data() as { tagId?: string };
    if (typeof d.tagId === "string") ids.add(d.tagId);
  }
  return ids;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  await fs.mkdir(args.outDir, { recursive: true });

  console.log(
    `Exporting sessions${args.from !== null ? ` from ${args.from}` : ""}${
      args.to !== null ? ` to ${args.to}` : ""
    }`,
  );

  let query: FirebaseFirestore.Query = db.collection("sessions");
  if (args.from !== null) {
    query = query.where("startedAt", ">=", Timestamp.fromMillis(Date.parse(`${args.from}T00:00:00Z`)));
  }
  if (args.to !== null) {
    query = query.where("startedAt", "<", Timestamp.fromMillis(Date.parse(`${args.to}T00:00:00Z`) + 24 * 3600_000));
  }
  const snap = await query.get();
  console.log(`Loaded ${snap.size} session docs.`);

  const rows: SessionRow[] = [];
  const totalTagsCache = new Map<string, number>();

  // Per-phase running totals (for summary means).
  const matchedByPhaseSum = new Map<OasisPhase, number>();
  for (const p of OASIS_PHASES_IN_ORDER) matchedByPhaseSum.set(p, 0);

  // Aggregates for summary.json
  const uniqueUids = new Set<string>();
  const dwellMinutesList: number[] = [];
  const userTurnsList: number[] = [];
  const deltas = { intensidadEmocional: [] as number[], apertura: [] as number[], confianzaEnLaAyuda: [] as number[] };
  const monthly = new Map<string, { sessions: number; dwellMinutesList: number[]; userTurnsList: number[]; safety: number }>();
  let safetyCount = 0;
  const DWELL_THRESHOLD_MIN = 5;
  let sessionsAtOrOverThreshold = 0;

  for (const doc of snap.docs) {
    const s = doc.data() as {
      userId?: string;
      scenarioId?: string;
      modo?: string;
      startedAt?: Timestamp;
      sesionIniciadaEn?: string | null;
      lastUserActivityAt?: Timestamp | null;
      lastActivityAt?: Timestamp;
      estadoMatriz?: { intensidadEmocional?: number; apertura?: number; confianzaEnLaAyuda?: number } | null;
      cohortCode?: string | null;
    };

    const scenarioId = s.scenarioId ?? "__unknown";
    const totalTags = await totalTagsForScenario(scenarioId, totalTagsCache);
    const matchedSet = await matchedTagsForSession(doc.id);
    const messageCounts = await scanMessages(doc.id);

    const sesionIniciadaAt = toTimestamp(s.sesionIniciadaEn ?? null);
    const dwell = dwellSeconds({
      sesionIniciadaEn: sesionIniciadaAt,
      lastUserActivityAt: s.lastUserActivityAt ?? null,
      lastUserMessageAt: messageCounts.lastUserMessageAt,
      lastActivityAt: s.lastActivityAt ?? null,
    });
    const dwellMin = dwell !== null ? dwell.seconds / 60 : null;

    const final = s.estadoMatriz;
    const init = INITIAL_ESTADO_MATRIZ;

    const row: SessionRow = {
      sessionId: doc.id,
      scenarioId,
      mode: s.modo ?? "escenario",
      startedAtIso: toIso(s.startedAt),
      sesionIniciadaEnIso: sesionIniciadaAt !== null ? sesionIniciadaAt.toDate().toISOString() : "",
      lastUserActivityAtIso: toIso(s.lastUserActivityAt),
      dwellMinutes: dwellMin !== null ? dwellMin.toFixed(2) : "",
      dwellSource: dwell !== null ? dwell.source : "",
      userTurns: messageCounts.userTurns,
      matchedTags: matchedSet.size,
      totalTags,
      achievementPct: totalTags === 0 ? 0 : Math.round((matchedSet.size / totalTags) * 100),
      intensidadEmocional_initial: init.intensidadEmocional,
      intensidadEmocional_final:
        final?.intensidadEmocional !== undefined ? String(final.intensidadEmocional) : "",
      intensidadEmocional_delta:
        final?.intensidadEmocional !== undefined
          ? String(final.intensidadEmocional - init.intensidadEmocional)
          : "",
      apertura_initial: init.apertura,
      apertura_final: final?.apertura !== undefined ? String(final.apertura) : "",
      apertura_delta:
        final?.apertura !== undefined ? String(final.apertura - init.apertura) : "",
      confianzaEnLaAyuda_initial: init.confianzaEnLaAyuda,
      confianzaEnLaAyuda_final:
        final?.confianzaEnLaAyuda !== undefined ? String(final.confianzaEnLaAyuda) : "",
      confianzaEnLaAyuda_delta:
        final?.confianzaEnLaAyuda !== undefined
          ? String(final.confianzaEnLaAyuda - init.confianzaEnLaAyuda)
          : "",
      safetyTriggered: messageCounts.safetyTriggered,
      cohortCode: s.cohortCode ?? "",
    };
    rows.push(row);

    // Summary aggregation
    if (typeof s.userId === "string" && s.userId.length > 0) uniqueUids.add(s.userId);
    if (dwellMin !== null) {
      dwellMinutesList.push(dwellMin);
      if (dwellMin >= DWELL_THRESHOLD_MIN) sessionsAtOrOverThreshold++;
    }
    userTurnsList.push(messageCounts.userTurns);
    if (messageCounts.safetyTriggered) safetyCount++;
    for (const tagId of matchedSet) {
      const phase = phaseFromTagId(tagId);
      if (phase !== null) {
        matchedByPhaseSum.set(phase, (matchedByPhaseSum.get(phase) ?? 0) + 1);
      }
    }
    if (final?.intensidadEmocional !== undefined) {
      deltas.intensidadEmocional.push(final.intensidadEmocional - init.intensidadEmocional);
    }
    if (final?.apertura !== undefined) deltas.apertura.push(final.apertura - init.apertura);
    if (final?.confianzaEnLaAyuda !== undefined) {
      deltas.confianzaEnLaAyuda.push(final.confianzaEnLaAyuda - init.confianzaEnLaAyuda);
    }

    // Monthly bucket (based on startedAt UTC)
    if (s.startedAt !== undefined) {
      const d = s.startedAt.toDate();
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      let bucket = monthly.get(key);
      if (bucket === undefined) {
        bucket = { sessions: 0, dwellMinutesList: [], userTurnsList: [], safety: 0 };
        monthly.set(key, bucket);
      }
      bucket.sessions++;
      if (dwellMin !== null) bucket.dwellMinutesList.push(dwellMin);
      bucket.userTurnsList.push(messageCounts.userTurns);
      if (messageCounts.safetyTriggered) bucket.safety++;
    }
  }

  // ── Write CSV ────────────────────────────────────────────────────────────
  const csvHeader = CSV_COLUMNS.join(",");
  const csvBody = rows
    .map((r) => CSV_COLUMNS.map((c) => csvEscape(r[c])).join(","))
    .join("\n");
  const csvPath = path.join(args.outDir, "sessions.csv");
  await fs.writeFile(csvPath, `${csvHeader}\n${csvBody}\n`, "utf8");
  console.log(`Wrote ${csvPath} (${rows.length} rows).`);

  // ── Write summary ────────────────────────────────────────────────────────
  const median = (xs: number[]): number => {
    if (xs.length === 0) return 0;
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);
  };
  const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const totalMinutes = dwellMinutesList.reduce((a, b) => a + b, 0);

  const matchedTagsPerPhaseMean: Record<string, number> = {};
  for (const p of OASIS_PHASES_IN_ORDER) {
    matchedTagsPerPhaseMean[p] = rows.length === 0 ? 0 : Math.round(((matchedByPhaseSum.get(p) ?? 0) / rows.length) * 100) / 100;
  }

  const monthlyOut: Record<string, unknown> = {};
  for (const [k, v] of [...monthly.entries()].sort()) {
    monthlyOut[k] = {
      sessions: v.sessions,
      medianDwellMinutes: Math.round(median(v.dwellMinutesList) * 100) / 100,
      totalDwellMinutes: Math.round(v.dwellMinutesList.reduce((a, b) => a + b, 0) * 100) / 100,
      medianUserTurns: Math.round(median(v.userTurnsList) * 100) / 100,
      safetyActivations: v.safety,
    };
  }

  const summary = {
    generatedAtIso: new Date().toISOString(),
    range: { from: args.from, to: args.to },
    totals: {
      sessions: rows.length,
      sessionsAtOrOverThresholdMinutes: sessionsAtOrOverThreshold,
      dwellThresholdMinutes: DWELL_THRESHOLD_MIN,
      uniqueUsers: uniqueUids.size,
      uniqueUsersNote: "userId counts anonymous auth uids as distinct users.",
      totalConversationMinutes: Math.round(totalMinutes * 100) / 100,
      medianConversationMinutes: Math.round(median(dwellMinutesList) * 100) / 100,
      medianUserTurns: Math.round(median(userTurnsList) * 100) / 100,
      safetyActivations: safetyCount,
    },
    matrixDeltasMean: {
      intensidadEmocional: Math.round(mean(deltas.intensidadEmocional) * 100) / 100,
      apertura: Math.round(mean(deltas.apertura) * 100) / 100,
      confianzaEnLaAyuda: Math.round(mean(deltas.confianzaEnLaAyuda) * 100) / 100,
    },
    matchedTagsPerPhaseMean,
    monthly: monthlyOut,
  };

  const summaryPath = path.join(args.outDir, "summary.json");
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`Wrote ${summaryPath}.`);

  console.log("\n=== summary.json ===");
  console.log(JSON.stringify(summary, null, 2));
}

await main();
process.exit(0);
