// One-shot backfill: compute analytics_rollups for historical days.
//
// Usage:
//   pnpm --filter @salvador/functions backfill:analytics -- 2026-06-17
//   pnpm --filter @salvador/functions backfill:analytics -- 2026-06-17 2026-07-10
//   pnpm --filter @salvador/functions backfill:analytics -- --workshop-day  (shorthand)
//
// Idempotent — writes analytics_rollups/{yyyymmdd}, overwriting existing docs.
// Historical sessions lack cohortCode → they roll up under the null cohort.
// Historical sessions lack endedAt → dwellSeconds() falls back to lastActivityAt.

if (!process.env["GCLOUD_PROJECT"] && !process.env["GOOGLE_CLOUD_PROJECT"]) {
  console.error("Set GCLOUD_PROJECT (or GOOGLE_CLOUD_PROJECT) before running.");
  process.exit(1);
}

// firebase-admin `initializeApp()` is called at module load inside
// src/config/firebase.ts — importing the builder here triggers it exactly once.
import { buildAndWriteRollupForDate } from "../src/analytics/rollupBuilder.js";
import { toSantiagoDate } from "../src/analytics/aggregators.js";

const WORKSHOP_DAY = "2026-06-17";

function parseArgs(argv: string[]): string[] {
  // pnpm forwards the "--" separator itself (unlike npm which strips it).
  // Drop it if present so `-- --workshop-day` and `-- 2026-06-17` both work.
  const args = argv.slice(2).filter((a) => a !== "--");
  if (args.length === 0) {
    console.error("Usage: backfill:analytics -- YYYY-MM-DD [YYYY-MM-DD ...]");
    console.error("       backfill:analytics -- --workshop-day");
    process.exit(1);
  }
  if (args[0] === "--workshop-day") return [WORKSHOP_DAY];

  // Range mode: 2 args, treat as inclusive range.
  if (args.length === 2 && args[0]!.match(/^\d{4}-\d{2}-\d{2}$/) && args[1]!.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [startStr, endStr] = args as [string, string];
    const dates: string[] = [];
    let cur = new Date(`${startStr}T12:00:00Z`);
    const stop = new Date(`${endStr}T12:00:00Z`);
    while (cur.getTime() <= stop.getTime()) {
      dates.push(toSantiagoDate(cur));
      cur = new Date(cur.getTime() + 24 * 3600_000);
    }
    return dates;
  }

  // Otherwise treat each arg as an individual date.
  for (const a of args) {
    if (!a.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error(`Bad date: ${a} — expected YYYY-MM-DD`);
      process.exit(1);
    }
  }
  return args;
}

const dates = parseArgs(process.argv);

console.log(`Backfilling ${dates.length} day(s): ${dates.join(", ")}`);
for (const dateStr of dates) {
  const start = Date.now();
  try {
    const result = await buildAndWriteRollupForDate(dateStr);
    const elapsed = Date.now() - start;
    console.log(`  ✓ ${dateStr} — groups=${result.groups} sessions=${result.sessions} (${elapsed}ms)`);
  } catch (err) {
    console.error(`  ✗ ${dateStr} — FAILED:`, err);
  }
}

console.log("Done.");
process.exit(0);
