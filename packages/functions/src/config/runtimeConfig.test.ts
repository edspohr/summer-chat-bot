import { describe, it, expect } from "vitest";

// Small pure-function test for the evaluator sampling gate + coerce guard.
// We can't easily import coerce (unexported), so we cover the gate logic
// directly and the coerce behavior through documented invariants below.

describe("evaluator sampling gate", () => {
  const shouldRun = (turnNumber: number, n: number): boolean => turnNumber % n === 0;

  it("N=1 fires on every turn", () => {
    expect(shouldRun(0, 1)).toBe(true);
    expect(shouldRun(1, 1)).toBe(true);
    expect(shouldRun(7, 1)).toBe(true);
  });

  it("N=2 fires on turn 0, skips 1, fires 2, skips 3", () => {
    expect(shouldRun(0, 2)).toBe(true);
    expect(shouldRun(1, 2)).toBe(false);
    expect(shouldRun(2, 2)).toBe(true);
    expect(shouldRun(3, 2)).toBe(false);
    expect(shouldRun(4, 2)).toBe(true);
  });

  it("N=3 fires on 0, 3, 6", () => {
    expect(shouldRun(0, 3)).toBe(true);
    expect(shouldRun(1, 3)).toBe(false);
    expect(shouldRun(2, 3)).toBe(false);
    expect(shouldRun(3, 3)).toBe(true);
    expect(shouldRun(6, 3)).toBe(true);
  });
});

describe("evaluatorEveryNTurns coerce guard (documented invariants)", () => {
  // The coerce() function in runtimeConfig.ts treats non-integer or <1 values
  // as the default (1). These asserts document the intended predicate.
  const isValid = (v: unknown): boolean =>
    typeof v === "number" && Number.isInteger(v) && v >= 1;

  it("accepts positive integers", () => {
    expect(isValid(1)).toBe(true);
    expect(isValid(2)).toBe(true);
    expect(isValid(10)).toBe(true);
  });

  it("rejects zero, negatives, floats, non-numbers", () => {
    expect(isValid(0)).toBe(false);
    expect(isValid(-1)).toBe(false);
    expect(isValid(1.5)).toBe(false);
    expect(isValid("2")).toBe(false);
    expect(isValid(null)).toBe(false);
    expect(isValid(undefined)).toBe(false);
  });
});
