// Per-user in-memory token bucket for coachTurn.
//
// Scope: one bucket per uid per warm container instance. Firebase Functions
// spreads users across containers, so effective throttling only bites when a
// single user hammers a single hot container — exactly the case we want to
// stop (accidental double-clicks, retry loops, one runaway trainee).
//
// This is deliberately NOT a global rate limiter. For that we'd need Firestore
// counters or Redis. For the formative workshop use case, per-user × per-instance
// is enough to prevent the "ocurrió un error" cascade seen at the June workshop.

interface Bucket {
  tokens: number;
  lastRefill: number; // ms since epoch
  capacity: number; // rpm at the time of last refill (respects config changes)
}

const buckets = new Map<string, Bucket>();

// Housekeeping: drop stale buckets so idle users don't accumulate forever.
const IDLE_TTL_MS = 10 * 60_000;

function sweep(now: number): void {
  for (const [uid, b] of buckets) {
    if (now - b.lastRefill > IDLE_TTL_MS) buckets.delete(uid);
  }
}

export interface RateCheckResult {
  allowed: boolean;
  retryAfterMs: number;
  tokensRemaining: number;
}

/** Deduct one token if available. `rpm` is read fresh each call so runtime
 *  config changes propagate without warm containers holding stale values. */
export function checkAndConsume(uid: string, rpm: number): RateCheckResult {
  const now = Date.now();
  if (buckets.size > 128) sweep(now);

  const capacity = Math.max(1, Math.floor(rpm));
  const tokensPerMs = capacity / 60_000;

  let b = buckets.get(uid);
  if (b === undefined) {
    b = { tokens: capacity, lastRefill: now, capacity };
    buckets.set(uid, b);
  }

  // Refill by elapsed time. If capacity changed since last call, keep the
  // saved token count but clamp to the new ceiling.
  const elapsed = now - b.lastRefill;
  const refilled = elapsed * tokensPerMs;
  b.tokens = Math.min(capacity, b.tokens + refilled);
  b.lastRefill = now;
  b.capacity = capacity;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { allowed: true, retryAfterMs: 0, tokensRemaining: Math.floor(b.tokens) };
  }

  const deficit = 1 - b.tokens;
  const retryAfterMs = Math.ceil(deficit / tokensPerMs);
  return { allowed: false, retryAfterMs, tokensRemaining: 0 };
}

/** Reserved for tests: clear all buckets. */
export function _resetRateLimiter(): void {
  buckets.clear();
}
