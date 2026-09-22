import { describe, it, expect } from "vitest";
import { computeTimerState, isSessionComplete } from "./timerService.js";
import { SESSION_COMPLETE_AT_SECONDS } from "@salvador/shared";

describe("computeTimerState", () => {
  it("returns zero elapsed when sesionIniciadaEn is null", () => {
    const state = computeTimerState(null);
    expect(state.elapsedSeconds).toBe(0);
    expect(state.sesionIniciadaEn).toBeNull();
  });

  it("computes elapsed seconds from an ISO start time", () => {
    const startMs = Date.now() - 120_000; // 2 minutes ago
    const iso = new Date(startMs).toISOString();
    const state = computeTimerState(iso);
    expect(state.elapsedSeconds).toBeGreaterThanOrEqual(119);
    expect(state.elapsedSeconds).toBeLessThanOrEqual(122); // 3s tolerance
    expect(state.sesionIniciadaEn).toBe(iso);
  });

  it("keeps counting past the completion threshold — no hard cap", () => {
    const startMs = Date.now() - 1_200_000; // 20 minutes ago
    const iso = new Date(startMs).toISOString();
    const state = computeTimerState(iso);
    expect(state.elapsedSeconds).toBeGreaterThanOrEqual(1199);
  });
});

describe("isSessionComplete", () => {
  it("is true at and above SESSION_COMPLETE_AT_SECONDS", () => {
    expect(isSessionComplete(SESSION_COMPLETE_AT_SECONDS)).toBe(true);
    expect(isSessionComplete(SESSION_COMPLETE_AT_SECONDS + 1)).toBe(true);
    expect(isSessionComplete(9999)).toBe(true);
  });

  it("is false below the threshold", () => {
    expect(isSessionComplete(0)).toBe(false);
    expect(isSessionComplete(SESSION_COMPLETE_AT_SECONDS - 1)).toBe(false);
  });
});
