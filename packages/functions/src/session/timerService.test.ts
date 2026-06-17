import { describe, it, expect } from "vitest";
import { computeTimerState, isTimerExpired } from "./timerService.js";

const SESSION_DURATION_SECONDS = 600;

describe("computeTimerState", () => {
  it("returns full duration when sesionIniciadaEn is null", () => {
    const state = computeTimerState(null, false);
    expect(state.remainingSeconds).toBe(SESSION_DURATION_SECONDS);
    expect(state.elapsedSeconds).toBe(0);
    expect(state.sesionIniciadaEn).toBeNull();
  });

  it("computes correct elapsed and remaining from a start time", () => {
    const startMs = Date.now() - 120_000; // 2 minutes ago
    const iso = new Date(startMs).toISOString();
    const state = computeTimerState(iso, false);
    expect(state.elapsedSeconds).toBeGreaterThanOrEqual(119);
    expect(state.elapsedSeconds).toBeLessThanOrEqual(122); // allow 3s tolerance
    expect(state.remainingSeconds).toBeLessThanOrEqual(SESSION_DURATION_SECONDS - 119);
  });

  it("preserves cronometroAnulado flag", () => {
    const state = computeTimerState(new Date().toISOString(), true);
    expect(state.cronometroAnulado).toBe(true);
  });
});

describe("isTimerExpired", () => {
  it("returns true when remaining <= 0 and not anulado", () => {
    const expired = isTimerExpired({
      sesionIniciadaEn: new Date(Date.now() - 700_000).toISOString(),
      elapsedSeconds: 700,
      remainingSeconds: -100,
      cronometroAnulado: false,
    });
    expect(expired).toBe(true);
  });

  it("returns false when cronometroAnulado even if time is up", () => {
    const expired = isTimerExpired({
      sesionIniciadaEn: new Date(Date.now() - 700_000).toISOString(),
      elapsedSeconds: 700,
      remainingSeconds: -100,
      cronometroAnulado: true,
    });
    expect(expired).toBe(false);
  });

  it("returns false when time remains", () => {
    const expired = isTimerExpired({
      sesionIniciadaEn: new Date().toISOString(),
      elapsedSeconds: 30,
      remainingSeconds: 570,
      cronometroAnulado: false,
    });
    expect(expired).toBe(false);
  });
});
