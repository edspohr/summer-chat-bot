// Retry wrapper for transient Vertex AI failures.
//
// Gemini 2.5 Flash uses Dynamic Shared Quota (DSQ) — there is no per-project
// quota to raise. Google returns 429 RESOURCE_EXHAUSTED when the shared pool
// is under global pressure. A short jittered backoff clears the majority of
// these bursts within a second.
//
// Retries fire on:
//   - 429 RESOURCE_EXHAUSTED / 503 UNAVAILABLE (DSQ pressure)
//   - Per-request TIMEOUT (added 2026-09-21 after two Vertex calls hung ~5
//     minutes each in the Fase 2 baseline until Node's UND_ERR_HEADERS_TIMEOUT
//     fired). The Vertex SDK does not surface an easy per-request deadline,
//     so we wrap each attempt in a Promise.race against a timer.
// All other errors propagate immediately so we don't mask real bugs.

const RETRIABLE_CODES: ReadonlySet<number> = new Set([429, 503]);
const RETRIABLE_STATUSES: ReadonlySet<string> = new Set([
  "RESOURCE_EXHAUSTED",
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
]);

interface VertexErrorShape {
  code?: number | string;
  status?: string;
  message?: string;
}

export class VertexRequestTimeoutError extends Error {
  code: string;
  status: string;
  constructor(label: string, timeoutMs: number) {
    super(`[${label}] request timed out after ${timeoutMs}ms`);
    this.code = "DEADLINE_EXCEEDED";
    this.status = "DEADLINE_EXCEEDED";
  }
}

function isRetriable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as VertexErrorShape;
  if (typeof e.code === "number" && RETRIABLE_CODES.has(e.code)) return true;
  if (typeof e.code === "string" && RETRIABLE_STATUSES.has(e.code)) return true;
  if (typeof e.status === "string" && RETRIABLE_STATUSES.has(e.status)) return true;
  if (typeof e.message === "string") {
    if (e.message.includes("429") || e.message.includes("RESOURCE_EXHAUSTED")) return true;
    if (e.message.includes("503") || e.message.includes("UNAVAILABLE")) return true;
    if (e.message.includes("DEADLINE_EXCEEDED")) return true;
    // Node/undici's headers timeout looks like this from the SDK.
    if (e.message.includes("UND_ERR_HEADERS_TIMEOUT")) return true;
  }
  return false;
}

function backoffMs(attempt: number): number {
  const base = 500 * 2 ** attempt;
  const jitter = Math.random() * 500;
  return base + jitter;
}

// Wraps a promise in a hard deadline. If the promise settles first, the
// timer is cleared. If the timer fires first, the returned promise rejects
// with `VertexRequestTimeoutError` — treated as retriable by `isRetriable`.
export function withTimeout<T>(
  p: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new VertexRequestTimeoutError(label, timeoutMs));
    }, timeoutMs);
    // `p` may not be a real Promise (mock in tests) — normalize with await.
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export interface RetryOptions {
  maxAttempts?: number;
  label?: string;
  /** Per-attempt deadline. Defaults: Call A callers should pass 20_000, Call B 30_000. */
  timeoutMs?: number;
}

export async function retryOnQuota<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const label = options.label ?? "vertex";
  const timeoutMs = options.timeoutMs ?? 30_000;

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs, label);
    } catch (err) {
      lastErr = err;
      if (!isRetriable(err) || attempt === maxAttempts - 1) throw err;
      const delay = backoffMs(attempt);
      const reason =
        err instanceof VertexRequestTimeoutError ? "timeout" : "retriable";
      console.warn(
        `[${label}] ${reason} on attempt ${attempt + 1}/${maxAttempts} — waiting ${Math.round(delay)}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
