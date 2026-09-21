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
  /** Fase 4 formative report — model id for the coach_feedback_v1 call. */
  feedbackModel: string;
  /** Fase 4 — maxOutputTokens for the feedback model. Holgado. */
  feedbackMaxOutputTokens: number;
  /**
   * Fase 4 — thinkingBudget for the feedback model. Default 1024 (some
   * reasoning helps quote fidelity). If the response comes back with
   * finishReason=MAX_TOKENS, the generator retries once with 0.
   */
  feedbackThinkingBudget: number;
  /** Fase 4 — per-request Vertex deadline for the feedback call. */
  feedbackTimeoutMs: number;
}

const DEFAULTS: RuntimeConfig = {
  rpm: 120,
  // Fase 1 (2026-09-20): defaults raised from 60s/120s to 120s/240s. Rule
  // now is 2 min silent → Martina nudge, 2 more min silent → auto-close.
  inactivityNudgeMs: 120_000,
  inactivityCloseMs: 240_000,
  inactivityEnabled: true,
  rateLimitEnabled: false,
  crisisBranchingEnabled: false,
  evaluatorEveryNTurns: 1,
  feedbackModel: "gemini-2.5-flash",
  feedbackMaxOutputTokens: 4096,
  feedbackThinkingBudget: 1024,
  feedbackTimeoutMs: 30_000,
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
  const getStr = (k: "feedbackModel"): string => {
    const v = raw[k];
    return typeof v === "string" && v.length > 0 ? v : DEFAULTS[k];
  };
  const nonNegInt = (k: "feedbackMaxOutputTokens" | "feedbackThinkingBudget" | "feedbackTimeoutMs"): number => {
    const v = raw[k];
    return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : DEFAULTS[k];
  };
  return {
    rpm: get("rpm", "number"),
    inactivityNudgeMs: get("inactivityNudgeMs", "number"),
    inactivityCloseMs: get("inactivityCloseMs", "number"),
    inactivityEnabled: get("inactivityEnabled", "boolean"),
    rateLimitEnabled: get("rateLimitEnabled", "boolean"),
    crisisBranchingEnabled: get("crisisBranchingEnabled", "boolean"),
    evaluatorEveryNTurns,
    feedbackModel: getStr("feedbackModel"),
    feedbackMaxOutputTokens: nonNegInt("feedbackMaxOutputTokens"),
    feedbackThinkingBudget: nonNegInt("feedbackThinkingBudget"),
    feedbackTimeoutMs: nonNegInt("feedbackTimeoutMs"),
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
