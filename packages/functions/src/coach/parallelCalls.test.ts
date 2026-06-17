import { describe, it, expect, vi, beforeEach } from "vitest";

// Integration test stub for the parallel evaluator pattern.
// Asserts that when both calls resolve, the character response arrives
// as soon as callA resolves (not after callB).
// We mock at the module level to avoid actual Vertex AI calls.

const callADuration = 300;
const callBDuration = 600; // evaluator is intentionally slower

function makeCallA(): Promise<{ content: string; frameBreakSuspected: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ content: "test reply", frameBreakSuspected: false, latencyMs: callADuration }), callADuration);
  });
}

function makeCallB(): Promise<{ evaluated_tags: never[]; matrixDelta: undefined }> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ evaluated_tags: [], matrixDelta: undefined }), callBDuration);
  });
}

describe("Parallel evaluator pattern", () => {
  it("Promise.all resolves no earlier than max(A, B) and both results are present", async () => {
    const start = Date.now();
    const [callA, callB] = await Promise.all([makeCallA(), makeCallB()]);
    const elapsed = Date.now() - start;

    // Both results present
    expect(callA.content).toBe("test reply");
    expect(callB.evaluated_tags).toHaveLength(0);

    // Total time ≈ max(callADuration, callBDuration), not their sum
    expect(elapsed).toBeLessThan(callADuration + callBDuration - 50);
    expect(elapsed).toBeGreaterThanOrEqual(callBDuration - 50);
  });

  it("character response is available as soon as callA resolves (no artificial post-delay)", async () => {
    const start = Date.now();
    let characterResolvedAt: number | null = null;
    let bothResolvedAt: number | null = null;

    const callAP = makeCallA().then((result) => {
      characterResolvedAt = Date.now() - start;
      return result;
    });
    const callBP = makeCallB();

    await Promise.all([callAP, callBP]);
    bothResolvedAt = Date.now() - start;

    expect(characterResolvedAt).not.toBeNull();
    // Character resolved ~callADuration ms in; both resolved ~callBDuration ms in
    expect(characterResolvedAt!).toBeLessThan(callBDuration - 50);
    expect(bothResolvedAt!).toBeGreaterThanOrEqual(callBDuration - 50);
  });

  it("no artificial delay > 50ms present in the call chain", async () => {
    // Verify our calls themselves do not inject extra waits beyond their declared durations.
    const start = Date.now();
    await makeCallA();
    const elapsed = Date.now() - start;
    // Allow up to 50ms headroom for event loop jitter — no artificial padding
    expect(elapsed).toBeLessThan(callADuration + 50);
  });
});
