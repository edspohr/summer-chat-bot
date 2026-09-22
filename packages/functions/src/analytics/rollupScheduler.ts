// Daily analytics rollup — runs at 04:00 America/Santiago, computes the rollup
// for the previous calendar day, and writes it to analytics_rollups/{YYYY-MM-DD}.
//
// Same region constraint as inactivityScan: Cloud Scheduler is not offered in
// southamerica-west1, so this runs in southamerica-east1. Firestore reads/
// writes happen over the network. See ADR-001 amendment.
//
// This function is IDEMPOTENT — running it twice on the same day just
// overwrites the doc. The one-shot backfill script uses the same code path.

import { onSchedule } from "firebase-functions/v2/scheduler";
import { buildAndWriteRollupForDate } from "./rollupBuilder.js";
import { toSantiagoDate } from "./aggregators.js";

// Returns YYYY-MM-DD of the previous Santiago day, given a JS Date "now".
function previousSantiagoDate(now: Date): string {
  // Take the current Santiago day and subtract 24h. Because DST transitions
  // happen at 00:00 local, subtracting 24h from midday puts us safely inside
  // the previous day regardless of DST.
  const nowSantiagoStr = toSantiagoDate(now); // YYYY-MM-DD
  // Reconstruct as UTC noon of that day, subtract 24h, re-format.
  const noonUtc = new Date(`${nowSantiagoStr}T12:00:00Z`).getTime();
  const yesterdayUtc = new Date(noonUtc - 24 * 3600_000);
  return toSantiagoDate(yesterdayUtc);
}

export const analyticsRollupDaily = onSchedule(
  {
    schedule: "0 4 * * *", // 04:00 daily
    // Region exception — see ADR-001 amendment. Firestore data stays in Chile.
    region: "southamerica-east1",
    timeZone: "America/Santiago",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const dateStr = previousSantiagoDate(new Date());
    const start = Date.now();
    try {
      const result = await buildAndWriteRollupForDate(dateStr);
      const elapsedMs = Date.now() - start;
      console.log(
        `[ROLLUP] Wrote analytics_rollups/${dateStr} — groups=${result.groups} sessions=${result.sessions} elapsedMs=${elapsedMs}`,
      );
    } catch (err) {
      console.error(`[ROLLUP] Failed for ${dateStr}:`, err);
      throw err;
    }
  },
);
