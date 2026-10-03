// Manual override for the warm-instance schedule (events outside the window,
// or re-warming after a deploy). Uses Application Default Credentials.
//
//   pnpm --filter @salvador/functions warm:up     # service-level min → 1
//   pnpm --filter @salvador/functions warm:down   # service-level min → 0
//
// Same code path and target list as the scheduled jobs; ignores the holiday
// list. Runbook: docs/runbooks/warm-instances.md.
import {
  COLD_MIN_INSTANCES,
  WARM_MIN_INSTANCES,
  WARM_PROJECT_ID,
} from "../src/ops/warmConfig.js";
import { defaultWarmDeps, setAllTargets } from "../src/ops/warmInstances.js";

const direction = process.argv[2];
if (direction !== "up" && direction !== "down") {
  console.error("Usage: tsx scripts/warm-instances.ts up|down");
  process.exit(1);
}

const min = direction === "up" ? WARM_MIN_INSTANCES : COLD_MIN_INSTANCES;
const results = await setAllTargets(min, await defaultWarmDeps());
console.log(`[${WARM_PROJECT_ID}] service-level min instances → ${min}`, results);
process.exit(0);
