import { describe, it, expect } from "vitest";
import type { Timestamp } from "firebase-admin/firestore";
import { dwellSeconds, computeDwellStats, DWELL_THRESHOLD_MINUTES } from "./aggregators.js";

// Minimal Timestamp stub — the aggregator only calls `.toMillis()`. Importing
// the concrete class from firebase-admin at test time triggers admin SDK
// initialization on some Node/vitest combos and hangs the runner.
function ts(ms: number): Timestamp {
  return { toMillis: () => ms } as Timestamp;
}
const T0 = ts(1_700_000_000_000);
function tPlus(seconds: number): Timestamp {
  return ts(T0.toMillis() + seconds * 1000);
}

describe("DWELL_THRESHOLD_MINUTES", () => {
  it("is 5 (MED-01/MED-08 constant)", () => {
    expect(DWELL_THRESHOLD_MINUTES).toBe(5);
  });
});

describe("dwellSeconds — MED-01 semantics", () => {
  it("normal case: lastUserActivityAt - sesionIniciadaEn, marked user_activity", () => {
    const result = dwellSeconds({
      sesionIniciadaEn: T0,
      lastUserActivityAt: tPlus(420),
    });
    expect(result).toEqual({ seconds: 420, source: "user_activity" });
  });

  it("returns null when sesionIniciadaEn is missing (session never had a first user turn)", () => {
    const result = dwellSeconds({
      sesionIniciadaEn: null,
      lastUserActivityAt: tPlus(420),
      lastActivityAt: tPlus(500),
    });
    expect(result).toBeNull();
  });

  it("falls back to lastUserMessageAt when lastUserActivityAt is absent", () => {
    const result = dwellSeconds({
      sesionIniciadaEn: T0,
      lastUserActivityAt: null,
      lastUserMessageAt: tPlus(300),
      lastActivityAt: tPlus(600),
    });
    expect(result).toEqual({ seconds: 300, source: "fallback" });
  });

  it("falls back to lastActivityAt when both user-scoped fields are absent", () => {
    const result = dwellSeconds({
      sesionIniciadaEn: T0,
      lastUserActivityAt: null,
      lastUserMessageAt: null,
      lastActivityAt: tPlus(600),
    });
    expect(result).toEqual({ seconds: 600, source: "fallback" });
  });

  it("assistant-only activity does not affect dwell (uses user-scoped field, not lastActivityAt)", () => {
    // Simulates: user sent one message at T0+30, assistant + nudges kept
    // writing until T0+900. lastActivityAt is polluted; lastUserActivityAt
    // is the truthful one.
    const result = dwellSeconds({
      sesionIniciadaEn: T0,
      lastUserActivityAt: tPlus(30),
      lastActivityAt: tPlus(900),
    });
    expect(result).toEqual({ seconds: 30, source: "user_activity" });
  });

  it("returns null on negative interval (clock skew safety)", () => {
    const result = dwellSeconds({
      sesionIniciadaEn: tPlus(500),
      lastUserActivityAt: T0,
    });
    expect(result).toBeNull();
  });

  it("returns null when everything is missing", () => {
    const result = dwellSeconds({
      sesionIniciadaEn: null,
      lastUserActivityAt: null,
    });
    expect(result).toBeNull();
  });
});

describe("computeDwellStats — MED-01 fallback + no-start counts", () => {
  it("defaults fallbackCount and noStartCount to 0 when no extras passed", () => {
    const stats = computeDwellStats([120, 300, 600]);
    expect(stats.count).toBe(3);
    expect(stats.fallbackCount).toBe(0);
    expect(stats.noStartCount).toBe(0);
  });

  it("propagates extras.fallbackCount and extras.noStartCount", () => {
    const stats = computeDwellStats([120, 300, 600], { fallbackCount: 2, noStartCount: 4 });
    expect(stats.fallbackCount).toBe(2);
    expect(stats.noStartCount).toBe(4);
    // Sessions with no start are NOT in the values list — count reflects
    // only sessions with a valid dwell number.
    expect(stats.count).toBe(3);
  });

  it("empty input yields zeroed stats but preserves extras", () => {
    const stats = computeDwellStats([], { fallbackCount: 0, noStartCount: 7 });
    expect(stats.count).toBe(0);
    expect(stats.medianSeconds).toBe(0);
    expect(stats.noStartCount).toBe(7);
  });

  it("buckets around the 5-minute threshold", () => {
    // 299s → under5, 300s → 5-to-10, 599s → 5-to-10, 600s → over10
    const stats = computeDwellStats([299, 300, 599, 600]);
    expect(stats.under5Min).toBe(1);
    expect(stats.fiveToTenMin).toBe(2);
    expect(stats.overTenMin).toBe(1);
  });
});
