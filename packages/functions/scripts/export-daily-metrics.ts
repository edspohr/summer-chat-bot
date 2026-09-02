// Daily pilot metrics rollup for Fundación Summer.
//
// Emits one row per calendar day in America/Santiago plus one row per month
// covered by the range and one TOTAL row. Focused on matrix movement (the
// initial state is a design constant, so we report movement, not start).
//
// Usage (local, with a service account key):
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
//   export GCLOUD_PROJECT=summer-chatbot-dev
//   pnpm --filter @salvador/functions export:daily -- --from 2026-07-01 --to 2026-09-02
//
// The output CSV has a `# ...` comment header describing denominator rules,
// then a normal CSV header row. Days with zero sessions still appear so the
// series is continuous.
//
// Reuses the Firestore reading helpers and the shared initial matrix from
// export-pilot-data.ts / @salvador/shared — no matrix numbers are duplicated.

import { promises as fs } from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { dwellSeconds } from "../src/analytics/aggregators.js";
import {
  OASIS_PHASES_IN_ORDER,
  phaseFromTagId,
  initialMatrixFor,
  MARTINA_INITIAL_MATRIX,
  type OasisPhase,
} from "@salvador/shared";

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
  from: string;
  to: string;
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
  if (from === null || to === null) {
    console.error("Usage: export:daily -- --from YYYY-MM-DD --to YYYY-MM-DD");
    process.exit(1);
  }
  return { from, to, outDir };
}

// ── Time helpers ───────────────────────────────────────────────────────────

// Santiago local YYYY-MM-DD for a Date. `en-CA` returns ISO-shaped date parts.
const SANTIAGO_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const SANTIAGO_WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Santiago",
  weekday: "short",
});

function santiagoDateOf(d: Date): string {
  return SANTIAGO_DATE_FMT.format(d);
}
function santiagoWeekdayOf(dateStr: string): string {
  // Anchor at UTC noon so any TZ offset lands on the same wall-clock date.
  const [y, m, d] = dateStr.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
  return SANTIAGO_WEEKDAY_FMT.format(dt);
}
function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}
function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
function daysBetweenInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = nextDay(cur);
  }
  return out;
}
function monthsBetweenInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from.slice(0, 7);
  const end = to.slice(0, 7);
  while (cur <= end) {
    out.push(cur);
    const [y, m] = cur.split("-").map((n) => Number(n));
    const nm = (m ?? 1) + 1;
    const ny = nm > 12 ? (y ?? 1970) + 1 : y ?? 1970;
    const nmm = nm > 12 ? 1 : nm;
    cur = `${ny}-${String(nmm).padStart(2, "0")}`;
  }
  return out;
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

// ── Firestore reads ────────────────────────────────────────────────────────

interface ScenarioTagShape {
  requiredTags: string[]; // tag ids
  phaseTotals: Map<OasisPhase, number>;
}

async function loadScenarioTags(
  scenarioId: string,
  cache: Map<string, ScenarioTagShape>,
): Promise<ScenarioTagShape> {
  const cached = cache.get(scenarioId);
  if (cached !== undefined) return cached;
  const snap = await db.collection("scenarios").doc(scenarioId).get();
  const data = snap.data() as
    | { requiredTags?: Array<{ tagId?: string }> }
    | undefined;
  const requiredTags: string[] = [];
  const phaseTotals = new Map<OasisPhase, number>();
  for (const p of OASIS_PHASES_IN_ORDER) phaseTotals.set(p, 0);
  for (const t of data?.requiredTags ?? []) {
    if (typeof t.tagId === "string") {
      requiredTags.push(t.tagId);
      const ph = phaseFromTagId(t.tagId);
      if (ph !== null) phaseTotals.set(ph, (phaseTotals.get(ph) ?? 0) + 1);
    }
  }
  const shape: ScenarioTagShape = { requiredTags, phaseTotals };
  cache.set(scenarioId, shape);
  return shape;
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

// ── Per-session facts ─────────────────────────────────────────────────────

interface SessionFacts {
  scenarioId: string;
  santiagoDate: string | null; // null when sesionIniciadaEn is missing
  fallbackSantiagoDate: string | null; // startedAt-based, for "excluded" bucket
  userTurns: number;
  hasTurns: boolean;
  hasFiveTurns: boolean;
  hasMatrix: boolean;
  matrixDelta: {
    intensidad: number;
    apertura: number;
    confianza: number;
    finalIntensidad: number;
    finalApertura: number;
    finalConfianza: number;
  } | null;
  dwellMinutes: number | null;
  matched: Set<string>;
  safetyTriggered: boolean;
  state: string;
  cohortCode: string | null;
  userId: string | null;
}

// ── Bucket types ──────────────────────────────────────────────────────────

interface Bucket {
  key: string; // date, YYYY-MM or "TOTAL"
  facts: SessionFacts[];
  excluded: SessionFacts[]; // sessions without sesionIniciadaEn attributed here
}

function ensureBucket(map: Map<string, Bucket>, key: string): Bucket {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const b: Bucket = { key, facts: [], excluded: [] };
  map.set(key, b);
  return b;
}

// ── Stats helpers ─────────────────────────────────────────────────────────

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0
    ? ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
    : (s[mid] ?? 0);
}
function pct(numer: number, denom: number): number | null {
  if (denom === 0) return null;
  return (numer / denom) * 100;
}
function fmt1(v: number | null): string {
  if (v === null) return "";
  return v.toFixed(1);
}
function fmtInt(v: number): string {
  return String(v);
}

// ── Metrics computation ───────────────────────────────────────────────────

interface Row {
  date: string;
  cohortCodes: string;
  weekday: string;
  sessions_total: number;
  sessions_with_turns: number;
  sessions_excluded_no_start: number;
  unique_devices: number;
  minutes_total: number | null;
  minutes_median: number | null;
  turns_median: number | null;
  sessions_5plus_turns: number;
  intensidad_final_mean: number | null;
  intensidad_delta_mean: number | null;
  intensidad_delta_median: number | null;
  intensidad_improved_pct: number | null;
  intensidad_unchanged_pct: number | null;
  intensidad_worsened_pct: number | null;
  apertura_final_mean: number | null;
  apertura_delta_mean: number | null;
  apertura_delta_median: number | null;
  apertura_improved_pct: number | null;
  apertura_unchanged_pct: number | null;
  apertura_worsened_pct: number | null;
  confianza_final_mean: number | null;
  confianza_delta_mean: number | null;
  confianza_delta_median: number | null;
  confianza_improved_pct: number | null;
  confianza_unchanged_pct: number | null;
  confianza_worsened_pct: number | null;
  matrix_moved_any_pct: number | null;
  matrix_all_three_improved_pct: number | null;
  matrix_net_score_mean: number | null;
  intensidad_delta_mean_5t: number | null;
  intensidad_improved_pct_5t: number | null;
  apertura_delta_mean_5t: number | null;
  apertura_improved_pct_5t: number | null;
  confianza_delta_mean_5t: number | null;
  confianza_improved_pct_5t: number | null;
  matrix_moved_any_pct_5t: number | null;
  matrix_all_three_improved_pct_5t: number | null;
  matrix_net_score_mean_5t: number | null;
  oasis_achieved_mean: number | null;
  oasis_achieved_median: number | null;
  oasis_4plus_pct: number | null;
  observa_pct: number | null;
  acoge_pct: number | null;
  silencio_pct: number | null;
  ilumina_pct: number | null;
  sosten_pct: number | null;
  safety_activations: number;
  safety_sessions_pct: number | null;
  ended_completed_pct: number | null;
  ended_inactivity_pct: number | null;
  ended_crisis_pct: number | null;
  sessions_no_matrix: number;
}

const COLUMNS: Array<keyof Row> = [
  "date",
  "cohortCodes",
  "weekday",
  "sessions_total",
  "sessions_with_turns",
  "sessions_excluded_no_start",
  "unique_devices",
  "minutes_total",
  "minutes_median",
  "turns_median",
  "sessions_5plus_turns",
  "intensidad_final_mean",
  "intensidad_delta_mean",
  "intensidad_delta_median",
  "intensidad_improved_pct",
  "intensidad_unchanged_pct",
  "intensidad_worsened_pct",
  "apertura_final_mean",
  "apertura_delta_mean",
  "apertura_delta_median",
  "apertura_improved_pct",
  "apertura_unchanged_pct",
  "apertura_worsened_pct",
  "confianza_final_mean",
  "confianza_delta_mean",
  "confianza_delta_median",
  "confianza_improved_pct",
  "confianza_unchanged_pct",
  "confianza_worsened_pct",
  "matrix_moved_any_pct",
  "matrix_all_three_improved_pct",
  "matrix_net_score_mean",
  "intensidad_delta_mean_5t",
  "intensidad_improved_pct_5t",
  "apertura_delta_mean_5t",
  "apertura_improved_pct_5t",
  "confianza_delta_mean_5t",
  "confianza_improved_pct_5t",
  "matrix_moved_any_pct_5t",
  "matrix_all_three_improved_pct_5t",
  "matrix_net_score_mean_5t",
  "oasis_achieved_mean",
  "oasis_achieved_median",
  "oasis_4plus_pct",
  "observa_pct",
  "acoge_pct",
  "silencio_pct",
  "ilumina_pct",
  "sosten_pct",
  "safety_activations",
  "safety_sessions_pct",
  "ended_completed_pct",
  "ended_inactivity_pct",
  "ended_crisis_pct",
  "sessions_no_matrix",
];

// Columns that are always integers (never formatted with a decimal).
const INT_COLUMNS = new Set<keyof Row>([
  "sessions_total",
  "sessions_with_turns",
  "sessions_excluded_no_start",
  "unique_devices",
  "sessions_5plus_turns",
  "safety_activations",
  "sessions_no_matrix",
]);

const STRING_COLUMNS = new Set<keyof Row>(["date", "cohortCodes", "weekday"]);

function computeRow(
  label: string,
  bucket: Bucket,
  scenarioShapes: Map<string, ScenarioTagShape>,
): Row {
  const included = bucket.facts;
  const withTurns = included.filter((f) => f.hasTurns);
  const withMatrix = withTurns.filter((f) => f.hasMatrix && f.matrixDelta !== null);
  const withMatrix5t = withMatrix.filter((f) => f.hasFiveTurns);

  const cohortSet = new Set<string>();
  for (const f of included) {
    if (f.cohortCode !== null && f.cohortCode.length > 0) cohortSet.add(f.cohortCode);
  }
  const cohortCodes = [...cohortSet].sort().join("|");

  const uniqDev = new Set<string>();
  for (const f of withTurns) if (f.userId !== null) uniqDev.add(f.userId);

  const minutesArr: number[] = [];
  for (const f of withTurns) if (f.dwellMinutes !== null) minutesArr.push(f.dwellMinutes);
  const turnsArr = withTurns.map((f) => f.userTurns);

  const dInt = withMatrix.map((f) => f.matrixDelta!.intensidad);
  const dAp = withMatrix.map((f) => f.matrixDelta!.apertura);
  const dCf = withMatrix.map((f) => f.matrixDelta!.confianza);
  const fInt = withMatrix.map((f) => f.matrixDelta!.finalIntensidad);
  const fAp = withMatrix.map((f) => f.matrixDelta!.finalApertura);
  const fCf = withMatrix.map((f) => f.matrixDelta!.finalConfianza);

  const netScore = withMatrix.map(
    (f) => -f.matrixDelta!.intensidad + f.matrixDelta!.apertura + f.matrixDelta!.confianza,
  );
  const netScore5t = withMatrix5t.map(
    (f) => -f.matrixDelta!.intensidad + f.matrixDelta!.apertura + f.matrixDelta!.confianza,
  );

  const improvedInt = dInt.filter((d) => d < 0).length;
  const unchangedInt = dInt.filter((d) => d === 0).length;
  const worsenedInt = dInt.filter((d) => d > 0).length;
  const improvedAp = dAp.filter((d) => d > 0).length;
  const unchangedAp = dAp.filter((d) => d === 0).length;
  const worsenedAp = dAp.filter((d) => d < 0).length;
  const improvedCf = dCf.filter((d) => d > 0).length;
  const unchangedCf = dCf.filter((d) => d === 0).length;
  const worsenedCf = dCf.filter((d) => d < 0).length;

  const movedAny = withMatrix.filter(
    (f) =>
      f.matrixDelta!.intensidad !== 0 ||
      f.matrixDelta!.apertura !== 0 ||
      f.matrixDelta!.confianza !== 0,
  ).length;
  const allImproved = withMatrix.filter(
    (f) =>
      f.matrixDelta!.intensidad < 0 &&
      f.matrixDelta!.apertura > 0 &&
      f.matrixDelta!.confianza > 0,
  ).length;

  const movedAny5t = withMatrix5t.filter(
    (f) =>
      f.matrixDelta!.intensidad !== 0 ||
      f.matrixDelta!.apertura !== 0 ||
      f.matrixDelta!.confianza !== 0,
  ).length;
  const allImproved5t = withMatrix5t.filter(
    (f) =>
      f.matrixDelta!.intensidad < 0 &&
      f.matrixDelta!.apertura > 0 &&
      f.matrixDelta!.confianza > 0,
  ).length;
  const dInt5t = withMatrix5t.map((f) => f.matrixDelta!.intensidad);
  const dAp5t = withMatrix5t.map((f) => f.matrixDelta!.apertura);
  const dCf5t = withMatrix5t.map((f) => f.matrixDelta!.confianza);

  // OASIS
  const matchedCounts = withTurns.map((f) => f.matched.size);
  const oasis4plus = matchedCounts.filter((c) => c >= 4).length;

  const phaseRatios: Record<OasisPhase, number[]> = {
    OBSERVA: [],
    ACOGE: [],
    SILENCIO: [],
    ILUMINA: [],
    SOSTEN: [],
  };
  for (const f of withTurns) {
    const shape = scenarioShapes.get(f.scenarioId);
    if (shape === undefined) continue;
    const perPhaseMatched = new Map<OasisPhase, number>();
    for (const p of OASIS_PHASES_IN_ORDER) perPhaseMatched.set(p, 0);
    for (const t of f.matched) {
      const ph = phaseFromTagId(t);
      if (ph !== null) perPhaseMatched.set(ph, (perPhaseMatched.get(ph) ?? 0) + 1);
    }
    for (const p of OASIS_PHASES_IN_ORDER) {
      const total = shape.phaseTotals.get(p) ?? 0;
      if (total > 0) {
        phaseRatios[p].push(((perPhaseMatched.get(p) ?? 0) / total) * 100);
      }
    }
  }

  // Safety / closure
  const safetyN = withTurns.filter((f) => f.safetyTriggered).length;
  const completedN = withTurns.filter(
    (f) => f.state === "closed_completed" || f.state === "completed",
  ).length;
  const inactivityN = withTurns.filter((f) => f.state === "closed_inactivity").length;
  const crisisN = withTurns.filter((f) => f.state === "crisis_interrupted").length;

  const noMatrixN = withTurns.filter((f) => !f.hasMatrix).length;

  return {
    date: label,
    cohortCodes,
    weekday: label.length === 10 ? santiagoWeekdayOf(label) : "",
    sessions_total: included.length + bucket.excluded.length,
    sessions_with_turns: withTurns.length,
    sessions_excluded_no_start: bucket.excluded.length,
    unique_devices: uniqDev.size,
    minutes_total:
      minutesArr.length === 0 ? null : minutesArr.reduce((a, b) => a + b, 0),
    minutes_median: median(minutesArr),
    turns_median: median(turnsArr),
    sessions_5plus_turns: withTurns.filter((f) => f.hasFiveTurns).length,
    intensidad_final_mean: mean(fInt),
    intensidad_delta_mean: mean(dInt),
    intensidad_delta_median: median(dInt),
    intensidad_improved_pct: pct(improvedInt, withMatrix.length),
    intensidad_unchanged_pct: pct(unchangedInt, withMatrix.length),
    intensidad_worsened_pct: pct(worsenedInt, withMatrix.length),
    apertura_final_mean: mean(fAp),
    apertura_delta_mean: mean(dAp),
    apertura_delta_median: median(dAp),
    apertura_improved_pct: pct(improvedAp, withMatrix.length),
    apertura_unchanged_pct: pct(unchangedAp, withMatrix.length),
    apertura_worsened_pct: pct(worsenedAp, withMatrix.length),
    confianza_final_mean: mean(fCf),
    confianza_delta_mean: mean(dCf),
    confianza_delta_median: median(dCf),
    confianza_improved_pct: pct(improvedCf, withMatrix.length),
    confianza_unchanged_pct: pct(unchangedCf, withMatrix.length),
    confianza_worsened_pct: pct(worsenedCf, withMatrix.length),
    matrix_moved_any_pct: pct(movedAny, withMatrix.length),
    matrix_all_three_improved_pct: pct(allImproved, withMatrix.length),
    matrix_net_score_mean: mean(netScore),
    intensidad_delta_mean_5t: mean(dInt5t),
    intensidad_improved_pct_5t: pct(
      dInt5t.filter((d) => d < 0).length,
      withMatrix5t.length,
    ),
    apertura_delta_mean_5t: mean(dAp5t),
    apertura_improved_pct_5t: pct(
      dAp5t.filter((d) => d > 0).length,
      withMatrix5t.length,
    ),
    confianza_delta_mean_5t: mean(dCf5t),
    confianza_improved_pct_5t: pct(
      dCf5t.filter((d) => d > 0).length,
      withMatrix5t.length,
    ),
    matrix_moved_any_pct_5t: pct(movedAny5t, withMatrix5t.length),
    matrix_all_three_improved_pct_5t: pct(allImproved5t, withMatrix5t.length),
    matrix_net_score_mean_5t: mean(netScore5t),
    oasis_achieved_mean: mean(matchedCounts),
    oasis_achieved_median: median(matchedCounts),
    oasis_4plus_pct: pct(oasis4plus, withTurns.length),
    observa_pct: mean(phaseRatios.OBSERVA),
    acoge_pct: mean(phaseRatios.ACOGE),
    silencio_pct: mean(phaseRatios.SILENCIO),
    ilumina_pct: mean(phaseRatios.ILUMINA),
    sosten_pct: mean(phaseRatios.SOSTEN),
    safety_activations: safetyN,
    safety_sessions_pct: pct(safetyN, withTurns.length),
    ended_completed_pct: pct(completedN, withTurns.length),
    ended_inactivity_pct: pct(inactivityN, withTurns.length),
    ended_crisis_pct: pct(crisisN, withTurns.length),
    sessions_no_matrix: noMatrixN,
  };
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes("\"") || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
function rowToCsv(row: Row): string {
  return COLUMNS.map((c) => {
    const v = row[c];
    if (STRING_COLUMNS.has(c)) return csvEscape(String(v ?? ""));
    if (v === null) return "";
    if (typeof v === "number") {
      if (INT_COLUMNS.has(c)) return fmtInt(v);
      return fmt1(v);
    }
    return csvEscape(String(v));
  }).join(",");
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  await fs.mkdir(args.outDir, { recursive: true });

  console.log(`Exporting daily metrics from ${args.from} to ${args.to} (America/Santiago).`);

  // Range filter uses startedAt UTC bounds wide enough to cover the target
  // Santiago range. Since Santiago is UTC-3/4, we widen by a full day either
  // side and re-check per-session using santiagoDateOf().
  const fromMs = Date.parse(`${args.from}T00:00:00Z`) - 24 * 3600_000;
  const toMs = Date.parse(`${args.to}T00:00:00Z`) + 2 * 24 * 3600_000;

  const snap = await db
    .collection("sessions")
    .where("startedAt", ">=", Timestamp.fromMillis(fromMs))
    .where("startedAt", "<", Timestamp.fromMillis(toMs))
    .get();
  console.log(`Loaded ${snap.size} session docs from Firestore.`);

  const scenarioShapes = new Map<string, ScenarioTagShape>();
  const allFacts: SessionFacts[] = [];

  for (const doc of snap.docs) {
    const s = doc.data() as {
      userId?: string;
      scenarioId?: string;
      state?: string;
      startedAt?: Timestamp;
      sesionIniciadaEn?: string | Timestamp | null;
      lastUserActivityAt?: Timestamp | null;
      lastActivityAt?: Timestamp;
      estadoMatriz?: {
        intensidadEmocional?: number;
        apertura?: number;
        confianzaEnLaAyuda?: number;
      } | null;
      cohortCode?: string | null;
    };

    const scenarioId = s.scenarioId ?? "__unknown";
    await loadScenarioTags(scenarioId, scenarioShapes);
    const matched = await matchedTagsForSession(doc.id);
    const msgs = await scanMessages(doc.id);

    const iniciada = toTimestamp(s.sesionIniciadaEn ?? null);
    const dwell = dwellSeconds({
      sesionIniciadaEn: iniciada,
      lastUserActivityAt: s.lastUserActivityAt ?? null,
      lastUserMessageAt: msgs.lastUserMessageAt,
      lastActivityAt: s.lastActivityAt ?? null,
    });

    const init = initialMatrixFor(scenarioId) ?? MARTINA_INITIAL_MATRIX;
    const final = s.estadoMatriz;
    const hasMatrix =
      final !== null &&
      final !== undefined &&
      typeof final.intensidadEmocional === "number" &&
      typeof final.apertura === "number" &&
      typeof final.confianzaEnLaAyuda === "number";
    const matrixDelta = hasMatrix
      ? {
          intensidad: (final!.intensidadEmocional as number) - init.intensidadEmocional,
          apertura: (final!.apertura as number) - init.apertura,
          confianza: (final!.confianzaEnLaAyuda as number) - init.confianzaEnLaAyuda,
          finalIntensidad: final!.intensidadEmocional as number,
          finalApertura: final!.apertura as number,
          finalConfianza: final!.confianzaEnLaAyuda as number,
        }
      : null;

    const santiagoDate = iniciada !== null ? santiagoDateOf(iniciada.toDate()) : null;
    const fallbackSantiagoDate =
      s.startedAt !== undefined ? santiagoDateOf(s.startedAt.toDate()) : null;

    allFacts.push({
      scenarioId,
      santiagoDate,
      fallbackSantiagoDate,
      userTurns: msgs.userTurns,
      hasTurns: msgs.userTurns >= 1,
      hasFiveTurns: msgs.userTurns >= 5,
      hasMatrix,
      matrixDelta,
      dwellMinutes: dwell !== null ? dwell.seconds / 60 : null,
      matched,
      safetyTriggered: msgs.safetyTriggered,
      state: s.state ?? "",
      cohortCode: s.cohortCode ?? null,
      userId: s.userId ?? null,
    });
  }

  // ── Bucketize ────────────────────────────────────────────────────────────
  const dayBuckets = new Map<string, Bucket>();
  const monthBuckets = new Map<string, Bucket>();
  const totalBucket: Bucket = { key: "TOTAL", facts: [], excluded: [] };

  const days = daysBetweenInclusive(args.from, args.to);
  for (const d of days) ensureBucket(dayBuckets, d);
  const months = monthsBetweenInclusive(args.from, args.to);
  for (const m of months) ensureBucket(monthBuckets, m);

  for (const f of allFacts) {
    if (f.santiagoDate !== null && f.santiagoDate >= args.from && f.santiagoDate <= args.to) {
      ensureBucket(dayBuckets, f.santiagoDate).facts.push(f);
      const mk = monthKeyOf(f.santiagoDate);
      if (monthBuckets.has(mk)) monthBuckets.get(mk)!.facts.push(f);
      totalBucket.facts.push(f);
    } else if (
      f.santiagoDate === null &&
      f.fallbackSantiagoDate !== null &&
      f.fallbackSantiagoDate >= args.from &&
      f.fallbackSantiagoDate <= args.to
    ) {
      // Session missing sesionIniciadaEn: bucket by startedAt for excluded count.
      const mk = monthKeyOf(f.fallbackSantiagoDate);
      if (monthBuckets.has(mk)) monthBuckets.get(mk)!.excluded.push(f);
      totalBucket.excluded.push(f);
    }
    // Sessions outside the target date range are dropped silently.
  }

  // ── Rows ─────────────────────────────────────────────────────────────────
  const rows: Row[] = [];
  for (const d of days) {
    rows.push(computeRow(d, dayBuckets.get(d)!, scenarioShapes));
  }
  for (const m of months) {
    rows.push(computeRow(m, monthBuckets.get(m)!, scenarioShapes));
  }
  rows.push(computeRow("TOTAL", totalBucket, scenarioShapes));

  // ── Write CSV ────────────────────────────────────────────────────────────
  const comments = [
    "# Daily pilot metrics — Fundación Summer",
    `# Range: ${args.from}..${args.to} (America/Santiago local dates)`,
    "# Row assignment: date = local date of sesionIniciadaEn.",
    "# Sessions without sesionIniciadaEn are excluded from per-day matrix/OASIS/volume",
    "#   metrics and only appear in sessions_excluded_no_start on monthly/TOTAL rows.",
    "# Denominators:",
    "#   sessions_with_turns  = sessions with >=1 user turn (excludes nudges).",
    "#   matrix % and *_delta_* → sessions_with_turns AND estadoMatriz not null.",
    "#   *_5t                  → matrix subset AND user_turns >= 5.",
    "#   OASIS % / *_pct       → sessions_with_turns (phase % skips scenarios with 0 tags in that phase).",
    "#   safety_/ended_ %      → sessions_with_turns.",
    "# Improvement direction: intensidad ↓ improves; apertura ↑ improves; confianza ↑ improves.",
    "# matrix_net_score = (−Δintensidad) + Δapertura + Δconfianza  (positive = better).",
    "# Percentages are 0-100. Averages/percentages formatted with one decimal.",
    "# Empty cell = undefined (denominator was zero).",
  ].join("\n");
  const header = COLUMNS.join(",");
  const body = rows.map(rowToCsv).join("\n");
  const outPath = path.join(args.outDir, "daily-metrics.csv");
  await fs.writeFile(outPath, `${comments}\n${header}\n${body}\n`, "utf8");
  console.log(`Wrote ${outPath} (${rows.length} rows).`);

  // Print highlights to stdout.
  const totalRow = rows[rows.length - 1]!;
  console.log("\n=== TOTAL ===");
  console.log(JSON.stringify(totalRow, null, 2));
}

await main();
process.exit(0);
