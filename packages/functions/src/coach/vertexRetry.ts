// Retry wrapper for transient Vertex AI throttling.
//
// Gemini 2.5 Flash uses Dynamic Shared Quota (DSQ) — there is no per-project
// quota to raise. Google returns 429 RESOURCE_EXHAUSTED when the shared pool is
// under global pressure. A short jittered backoff clears the majority of these
// bursts within a second.
//
// Retries only fire on 429 / RESOURCE_EXHAUSTED / 503 UNAVAILABLE. All other
// errors propagate immediately so we don't mask real bugs.

const RETRIABLE_CODES: ReadonlySet<number> = new Set([429, 503]);
const RETRIABLE_STATUSES: ReadonlySet<string> = new Set(["RESOURCE_EXHAUSTED", "UNAVAILABLE"]);

interface VertexErrorShape {
  code?: number;
  status?: string;
  message?: string;
}

function isRetriable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as VertexErrorShape;
  if (typeof e.code === "number" && RETRIABLE_CODES.has(e.code)) return true;
  if (typeof e.status === "string" && RETRIABLE_STATUSES.has(e.status)) return true;
  if (typeof e.message === "string") {
    if (e.message.includes("429") || e.message.includes("RESOURCE_EXHAUSTED")) return true;
    if (e.message.includes("503") || e.message.includes("UNAVAILABLE")) return true;
  }
  return false;
}

// Wider base and jitter than the original 250/200 to (a) give DSQ a longer
// window to drain without adding retry attempts (avoids retry storm), and
// (b) desynchronize concurrent clients in a workshop burst.
function backoffMs(attempt: number): number {
  const base = 500 * 2 ** attempt;
  const jitter = Math.random() * 500;
  return base + jitter;
}

export interface RetryOptions {
  maxAttempts?: number;
  label?: string;
}

export async function retryOnQuota<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const label = options.label ?? "vertex";

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetriable(err) || attempt === maxAttempts - 1) throw err;
      const delay = backoffMs(attempt);
      console.warn(
        `[${label}] Retriable error on attempt ${attempt + 1}/${maxAttempts} — waiting ${Math.round(delay)}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
