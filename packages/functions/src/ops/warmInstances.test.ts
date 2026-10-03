// Pure-function tests: fake fetch, no Firestore, no real credentials.
import { describe, it, expect } from "vitest";
import {
  isChileHoliday,
  santiagoDate,
  setAllTargets,
  setServiceMinInstances,
  type FetchLike,
  type WarmDeps,
} from "./warmInstances.js";
import {
  CHILE_HOLIDAYS,
  CHILE_HOLIDAYS_COVERED_UNTIL,
  WARM_TARGET_SERVICES,
} from "./warmConfig.js";

interface Call {
  method: string;
  url: string;
  body: string | undefined;
}

function fakeDeps(
  serviceAnnotations: Record<string, string>,
  putStatus = 200,
): { deps: WarmDeps; calls: Call[] } {
  const calls: Call[] = [];
  const fetchFn: FetchLike = async (url, init) => {
    calls.push({ method: init.method, url, body: init.body });
    if (init.method === "GET") {
      const service = {
        metadata: { name: "svc", annotations: serviceAnnotations },
        spec: { template: { metadata: { name: "svc-00001-abc" } } },
      };
      return { ok: true, status: 200, text: async () => JSON.stringify(service) };
    }
    return { ok: putStatus === 200, status: putStatus, text: async () => "{}" };
  };
  return { deps: { fetchFn, getAccessToken: async () => "token" }, calls };
}

function putAnnotations(call: Call | undefined): Record<string, string> {
  const parsed = JSON.parse(call?.body ?? "{}") as {
    metadata: { annotations: Record<string, string> };
  };
  return parsed.metadata.annotations;
}

describe("santiagoDate", () => {
  it("uses the America/Santiago calendar day, in summer (UTC-3) and winter (UTC-4)", () => {
    // 02:30 UTC is still the previous evening in Santiago.
    expect(santiagoDate(new Date("2026-12-09T02:30:00Z"))).toBe("2026-12-08");
    expect(santiagoDate(new Date("2027-06-22T03:30:00Z"))).toBe("2027-06-21");
    expect(santiagoDate(new Date("2027-06-21T13:00:00Z"))).toBe("2027-06-21");
  });
});

describe("holiday list", () => {
  it("skips a holiday at 09:00 local and not the day after", () => {
    expect(isChileHoliday(new Date("2026-10-12T12:00:00Z"))).toBe(true);
    expect(isChileHoliday(new Date("2026-10-13T12:00:00Z"))).toBe(false);
  });

  it("is well-formed, sorted, unique and inside the covered range", () => {
    for (const d of CHILE_HOLIDAYS) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([...CHILE_HOLIDAYS].sort()).toEqual([...CHILE_HOLIDAYS]);
    expect(new Set(CHILE_HOLIDAYS).size).toBe(CHILE_HOLIDAYS.length);
    expect(CHILE_HOLIDAYS.every((d) => d <= CHILE_HOLIDAYS_COVERED_UNTIL)).toBe(true);
  });
});

describe("setServiceMinInstances", () => {
  it("sets the service-level annotation and leaves the template untouched", async () => {
    const { deps, calls } = fakeDeps({ "run.googleapis.com/maxScale": "20" });
    expect(await setServiceMinInstances("coachturn", 1, deps)).toBe("updated");
    expect(calls.map((c) => c.method)).toEqual(["GET", "PUT"]);
    expect(calls[1]?.url).toContain(
      "southamerica-west1-run.googleapis.com/apis/serving.knative.dev/v1/namespaces/summer-chatbot-dev/services/coachturn",
    );
    expect(putAnnotations(calls[1])).toEqual({
      "run.googleapis.com/maxScale": "20",
      "run.googleapis.com/minScale": "1",
    });
    expect(JSON.parse(calls[1]?.body ?? "{}")).toMatchObject({
      spec: { template: { metadata: { name: "svc-00001-abc" } } },
    });
  });

  it("is a no-op when already at the requested value", async () => {
    const warm = fakeDeps({ "run.googleapis.com/minScale": "1" });
    expect(await setServiceMinInstances("coachturn", 1, warm.deps)).toBe("unchanged");
    expect(warm.calls.map((c) => c.method)).toEqual(["GET"]);

    const cold = fakeDeps({});
    expect(await setServiceMinInstances("coachturn", 0, cold.deps)).toBe("unchanged");
    expect(cold.calls.map((c) => c.method)).toEqual(["GET"]);
  });

  it("removes the annotation when cooling down", async () => {
    const { deps, calls } = fakeDeps({
      "run.googleapis.com/maxScale": "20",
      "run.googleapis.com/minScale": "1",
    });
    expect(await setServiceMinInstances("mentorchat", 0, deps)).toBe("updated");
    expect(putAnnotations(calls[1])).toEqual({ "run.googleapis.com/maxScale": "20" });
  });

  it("throws on a failed write so the scheduler retries", async () => {
    const { deps } = fakeDeps({}, 409);
    await expect(setServiceMinInstances("coachturn", 1, deps)).rejects.toThrow("HTTP 409");
  });
});

describe("setAllTargets", () => {
  it("updates every configured target", async () => {
    const { deps, calls } = fakeDeps({});
    const results = await setAllTargets(1, deps);
    expect(Object.keys(results).sort()).toEqual([...WARM_TARGET_SERVICES].sort());
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(WARM_TARGET_SERVICES.length);
  });
});
