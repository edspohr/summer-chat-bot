// Runtime-tunable configuration read from Firestore doc `config/runtime`.
// Purpose: values that must change per workshop without redeploying (rate limit,
// inactivity thresholds, feature flags for Phases 3–4).
//
// Reads are cached in-memory with a short TTL so hot-path callers (coachHandler
// runs on every turn) don't hit Firestore each time. TTL is short enough that
// flipping a flag propagates within tens of seconds across all warm instances.

import { db } from "./firebase.js";

export interface RuntimeConfig {
  /** Maximum turns per minute per user. Consumed in Phase 3. */
  rpm: number;
  /** Milliseconds of user inactivity before Martina sends a proactive nudge. */
  inactivityNudgeMs: number;
  /** Milliseconds of user inactivity before the scheduler closes the session. */
  inactivityCloseMs: number;
  /** Master switch for the Phase 3 inactivity scheduler. */
  inactivityEnabled: boolean;
  /** Master switch for the Phase 3 per-user token bucket. */
  rateLimitEnabled: boolean;
  /** Master switch for the Phase 4 crisis mentor branching UX. */
  crisisBranchingEnabled: boolean;
  /**
   * Fire Call B only every N-th turn. 1 = every turn (default).
   * Set to 2 during heavy workshops to halve Vertex DSQ pressure.
   * Turn 0 always evaluates.
   */
  evaluatorEveryNTurns: number;
}

const DEFAULTS: RuntimeConfig = {
  rpm: 120,
  inactivityNudgeMs: 60_000,
  inactivityCloseMs: 120_000,
  inactivityEnabled: false,
  rateLimitEnabled: false,
  crisisBranchingEnabled: false,
  evaluatorEveryNTurns: 1,
};

const TTL_MS = 30_000;

let cached: { value: RuntimeConfig; expiresAt: number } | null = null;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function coerce(raw: unknown): RuntimeConfig {
  if (!isRecord(raw)) return { ...DEFAULTS };
  const get = <K extends keyof RuntimeConfig>(k: K, type: "number" | "boolean"): RuntimeConfig[K] => {
    const v = raw[k];
    if (typeof v === type) return v as RuntimeConfig[K];
    return DEFAULTS[k];
  };
  const rawEvery = raw["evaluatorEveryNTurns"];
  const evaluatorEveryNTurns =
    typeof rawEvery === "number" && Number.isInteger(rawEvery) && rawEvery >= 1
      ? rawEvery
      : DEFAULTS.evaluatorEveryNTurns;
  return {
    rpm: get("rpm", "number"),
    inactivityNudgeMs: get("inactivityNudgeMs", "number"),
    inactivityCloseMs: get("inactivityCloseMs", "number"),
    inactivityEnabled: get("inactivityEnabled", "boolean"),
    rateLimitEnabled: get("rateLimitEnabled", "boolean"),
    crisisBranchingEnabled: get("crisisBranchingEnabled", "boolean"),
    evaluatorEveryNTurns,
  };
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const now = Date.now();
  if (cached !== null && cached.expiresAt > now) return cached.value;
  try {
    const snap = await db.collection("config").doc("runtime").get();
    const value = coerce(snap.exists ? snap.data() : {});
    cached = { value, expiresAt: now + TTL_MS };
    return value;
  } catch (err) {
    console.error("[RUNTIME_CONFIG] Failed to load config/runtime, using defaults", err);
    const value = { ...DEFAULTS };
    cached = { value, expiresAt: now + TTL_MS };
    return value;
  }
}

// Reserved for tests: clear the memoized value.
export function _resetRuntimeConfigCache(): void {
  cached = null;
}
