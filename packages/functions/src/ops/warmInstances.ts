// Sets the Cloud Run SERVICE-level min instances of the chat-turn services.
//
// Uses the Cloud Run Admin API v1 (GET + PUT of the Service with the
// `run.googleapis.com/minScale` annotation on the Service metadata). That is
// what `gcloud run services update --min` does: it changes scaling without
// creating a new revision. The v2 PATCH route was rejected for these
// Functions-managed services (409 "Revision named ... with different
// configuration already exists"), because their template pins the revision
// name.
//
// No top-level import beyond the config constants: google-auth-library is
// loaded lazily so CLI discovery never pays for it.

import {
  CHILE_HOLIDAYS,
  WARM_PROJECT_ID,
  WARM_SERVICES_REGION,
  WARM_TARGET_SERVICES,
  WARM_TIME_ZONE,
} from "./warmConfig.js";

const SERVICE_MIN_SCALE_ANNOTATION = "run.googleapis.com/minScale";

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export interface WarmDeps {
  fetchFn: FetchLike;
  getAccessToken: () => Promise<string>;
}

export type WarmResult = "updated" | "unchanged";

/** Calendar date (YYYY-MM-DD) in America/Santiago for the given instant. */
export function santiagoDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WARM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isChileHoliday(now: Date): boolean {
  return CHILE_HOLIDAYS.includes(santiagoDate(now));
}

function serviceUrl(service: string): string {
  return (
    `https://${WARM_SERVICES_REGION}-run.googleapis.com/apis/serving.knative.dev/v1` +
    `/namespaces/${WARM_PROJECT_ID}/services/${service}`
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Idempotent: reads the service first and only writes when the service-level
 * min differs. A concurrent modification (e.g. a deploy in flight) makes the
 * PUT fail with 409; the caller's retry re-reads and converges.
 */
export async function setServiceMinInstances(
  service: string,
  minInstances: number,
  deps: WarmDeps,
): Promise<WarmResult> {
  const token = await deps.getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const url = serviceUrl(service);

  const getRes = await deps.fetchFn(url, { method: "GET", headers });
  if (!getRes.ok) {
    throw new Error(`GET ${service} failed with HTTP ${getRes.status}`);
  }
  const body: unknown = JSON.parse(await getRes.text());
  if (!isRecord(body) || !isRecord(body["metadata"])) {
    throw new Error(`GET ${service} returned an unexpected shape`);
  }
  const metadata = body["metadata"];
  const annotations: Record<string, unknown> = isRecord(metadata["annotations"])
    ? { ...metadata["annotations"] }
    : {};

  const raw = annotations[SERVICE_MIN_SCALE_ANNOTATION];
  const current = typeof raw === "string" ? Number.parseInt(raw, 10) : 0;
  if (current === minInstances) return "unchanged";

  if (minInstances === 0) {
    delete annotations[SERVICE_MIN_SCALE_ANNOTATION];
  } else {
    annotations[SERVICE_MIN_SCALE_ANNOTATION] = String(minInstances);
  }
  const updated = { ...body, metadata: { ...metadata, annotations } };

  const putRes = await deps.fetchFn(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(updated),
  });
  if (!putRes.ok) {
    throw new Error(`PUT ${service} failed with HTTP ${putRes.status}`);
  }
  return "updated";
}

/** Applies the same min to every target; throws if any target failed. */
export async function setAllTargets(
  minInstances: number,
  deps: WarmDeps,
): Promise<Record<string, WarmResult>> {
  const settled = await Promise.allSettled(
    WARM_TARGET_SERVICES.map((service) => setServiceMinInstances(service, minInstances, deps)),
  );
  const results: Record<string, WarmResult> = {};
  const failures: string[] = [];
  settled.forEach((outcome, i) => {
    const service = WARM_TARGET_SERVICES[i] ?? "unknown";
    if (outcome.status === "fulfilled") {
      results[service] = outcome.value;
    } else {
      failures.push(`${service}: ${String(outcome.reason)}`);
    }
  });
  if (failures.length > 0) {
    throw new Error(`Warm update failed — ${failures.join("; ")}`);
  }
  return results;
}

/** Real dependencies (Application Default Credentials + global fetch). */
export async function defaultWarmDeps(): Promise<WarmDeps> {
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  return {
    fetchFn: (url, init) => fetch(url, init),
    getAccessToken: async () => {
      const token = await auth.getAccessToken();
      if (typeof token !== "string" || token === "") {
        throw new Error("Could not obtain an access token");
      }
      return token;
    },
  };
}
