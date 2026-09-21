import { describe, it, expect, vi } from "vitest";
import { retryOnQuota, withTimeout, VertexRequestTimeoutError } from "./vertexRetry.js";

describe("retryOnQuota", () => {
  it("returns immediately on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryOnQuota(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 code and eventually succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("throttled"), { code: 429 }))
      .mockResolvedValueOnce("ok");
    const result = await retryOnQuota(fn, { label: "test" });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on RESOURCE_EXHAUSTED status", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("busy"), { status: "RESOURCE_EXHAUSTED" }))
      .mockResolvedValueOnce("ok");
    const result = await retryOnQuota(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on message containing 429", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("got status: 429 Too Many Requests"))
      .mockResolvedValueOnce("ok");
    const result = await retryOnQuota(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on non-retriable errors", async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("bad request"), { code: 400 }));
    await expect(retryOnQuota(fn)).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws the last error after exhausting attempts", async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("still busy"), { code: 429 }));
    await expect(retryOnQuota(fn, { maxAttempts: 3 })).rejects.toThrow("still busy");
    expect(fn).toHaveBeenCalledTimes(3);
  }, 10_000);

  it("rejects with VertexRequestTimeoutError when a request never resolves within timeoutMs", async () => {
    const fn = vi.fn(() => new Promise(() => { /* never resolves */ }));
    await expect(
      retryOnQuota(fn, { maxAttempts: 1, timeoutMs: 30 })
    ).rejects.toBeInstanceOf(VertexRequestTimeoutError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a timeout and succeeds on the next attempt", async () => {
    let call = 0;
    const fn = vi.fn(() =>
      new Promise<string>((resolve, reject) => {
        call += 1;
        if (call === 1) {
          // First attempt hangs long enough to trip the 30ms deadline
          setTimeout(() => reject(new Error("never")), 200);
        } else {
          resolve("ok");
        }
      })
    );
    const result = await retryOnQuota(fn, { maxAttempts: 3, timeoutMs: 30, label: "test" });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries when the SDK surfaces UND_ERR_HEADERS_TIMEOUT via the message", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fetch failed: UND_ERR_HEADERS_TIMEOUT"))
      .mockResolvedValueOnce("ok");
    const result = await retryOnQuota(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("withTimeout", () => {
  it("resolves with the inner value when it settles first", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, "unit");
    expect(result).toBe(42);
  });

  it("rejects with VertexRequestTimeoutError when the timer fires first", async () => {
    const p = new Promise<never>(() => { /* never */ });
    await expect(withTimeout(p, 20, "unit")).rejects.toBeInstanceOf(
      VertexRequestTimeoutError,
    );
  });

  it("clears the timer once the inner promise rejects", async () => {
    const err = new Error("real error");
    await expect(withTimeout(Promise.reject(err), 1000, "unit")).rejects.toBe(err);
  });
});
