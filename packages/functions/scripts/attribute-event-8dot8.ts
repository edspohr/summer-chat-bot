// Attribute pre-fix booth sessions to the 8.8 Unreal event.
//
// Before /martina started persisting ?src=8dot8 (hosting release on
// 2026-10-01 ~10:10 CLT), booth visitors still produced real Martina sessions,
// just without `source`. This script tags those sessions with source="8dot8"
// so the dashboard baseline comes from real data. New sessions keep adding on
// top via the normal trigger.
//
// Dry-run by default (prints counts only, no content). Writes only with --apply.
//
// Usage:
//   GCLOUD_PROJECT=summer-chatbot-dev pnpm --filter @salvador/functions exec tsx scripts/attribute-event-8dot8.ts [--until=HH:MM] [--apply]

if (!process.env["GCLOUD_PROJECT"] && !process.env["GOOGLE_CLOUD_PROJECT"]) {
  console.error("Set GCLOUD_PROJECT (or GOOGLE_CLOUD_PROJECT) before running.");
  process.exit(1);
}

import { Timestamp } from "firebase-admin/firestore";
import { EVENT_8DOT8 } from "@salvador/shared";
import { db } from "../src/config/firebase.js";
import { recomputeEventLive } from "../src/analytics/eventLive.js";

const MARTINA_SCENARIO_ID = "scenario_03_martina";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const untilArg = args.find((a) => a.startsWith("--until="))?.slice("--until=".length);
const untilMs =
  untilArg !== undefined ? Date.parse(`2026-10-01T${untilArg}:00-03:00`) : Date.parse(EVENT_8DOT8.endIso);

const snap = await db
  .collection("sessions")
  .where("startedAt", ">=", Timestamp.fromMillis(Date.parse(EVENT_8DOT8.startIso)))
  .get();

const candidates = snap.docs.filter((d) => {
  const x = d.data();
  const startedMs = (x["startedAt"] as Timestamp | undefined)?.toMillis() ?? 0;
  return x["scenarioId"] === MARTINA_SCENARIO_ID && x["source"] === undefined && startedMs <= untilMs;
});

const byHour = new Map<string, number>();
let withTurns = 0;
for (const d of candidates) {
  const x = d.data();
  const hour = (x["startedAt"] as Timestamp)
    .toDate()
    .toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", hourCycle: "h23" });
  byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  if (typeof x["turnCount"] === "number" && x["turnCount"] > 0) withTurns++;
}

console.log(`Martina sessions today without source: ${candidates.length} (${withTurns} with >=1 turn)`);
console.log("By start hour (CLT):", Object.fromEntries([...byHour.entries()].sort()));

if (!apply) {
  console.log("Dry run — nothing written. Re-run with --apply to tag them.");
  process.exit(0);
}

for (let i = 0; i < candidates.length; i += 400) {
  const batch = db.batch();
  for (const d of candidates.slice(i, i + 400)) batch.update(d.ref, { source: EVENT_8DOT8.source });
  await batch.commit();
}
const doc = await recomputeEventLive();
console.log(`Tagged ${candidates.length}. Dashboard now: sessions=${doc.sessions} tags=${doc.oasisTags}`);
process.exit(0);
