// Recompute event_live/8dot8 from scratch (backfill after deploy / fix drift).
//
// Usage:
//   GCLOUD_PROJECT=summer-chatbot-dev pnpm --filter @salvador/functions backfill:8dot8

if (!process.env["GCLOUD_PROJECT"] && !process.env["GOOGLE_CLOUD_PROJECT"]) {
  console.error("Set GCLOUD_PROJECT (or GOOGLE_CLOUD_PROJECT) before running.");
  process.exit(1);
}

import { recomputeEventLive } from "../src/analytics/eventLive.js";

const doc = await recomputeEventLive();
console.log(JSON.stringify({ ...doc, recentActivity: doc.recentActivity.length }, null, 2));
process.exit(0);
