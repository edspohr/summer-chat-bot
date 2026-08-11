import { describe, it, expect, vi } from "vitest";
import { retryOnQuota } from "./vertexRetry.js";

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
});
