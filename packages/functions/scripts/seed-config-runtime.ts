// One-shot: create/update config/runtime with the default values from
// runtimeConfig.ts. Idempotent — safe to re-run.
//
// Usage:
//   GCLOUD_PROJECT=summer-chatbot-dev \
//     pnpm --filter @salvador/functions tsx scripts/seed-config-runtime.ts
//
// Or pass overrides:
//   ... tsx scripts/seed-config-runtime.ts --inactivityEnabled=true

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env["GCLOUD_PROJECT"] && !process.env["GOOGLE_CLOUD_PROJECT"]) {
  console.error("Set GCLOUD_PROJECT (or GOOGLE_CLOUD_PROJECT) before running.");
  process.exit(1);
}

initializeApp();
const db = getFirestore();

interface RuntimeConfig {
  rpm: number;
  inactivityNudgeMs: number;
  inactivityCloseMs: number;
  inactivityEnabled: boolean;
  rateLimitEnabled: boolean;
  crisisBranchingEnabled: boolean;
}

const defaults: RuntimeConfig = {
  rpm: 120,
  inactivityNudgeMs: 60_000,
  inactivityCloseMs: 120_000,
  inactivityEnabled: true,
  rateLimitEnabled: false,
  crisisBranchingEnabled: false,
};

// Simple --key=value overrides, so we can tweak flags without editing the file.
const overrides: Partial<RuntimeConfig> = {};
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--(\w+)=(.+)$/);
  if (m === null) continue;
  const [, key, raw] = m as [string, keyof RuntimeConfig, string];
  if (!(key in defaults)) {
    console.error(`Unknown key: ${key}`);
    process.exit(1);
  }
  const expected = typeof defaults[key];
  if (expected === "number") {
    const n = Number(raw);
    if (Number.isNaN(n)) {
      console.error(`Bad number for ${key}: ${raw}`);
      process.exit(1);
    }
    (overrides as Record<string, unknown>)[key] = n;
  } else if (expected === "boolean") {
    if (raw !== "true" && raw !== "false") {
      console.error(`Bad boolean for ${key}: ${raw} — expected true|false`);
      process.exit(1);
    }
    (overrides as Record<string, unknown>)[key] = raw === "true";
  }
}

const value: RuntimeConfig = { ...defaults, ...overrides };

console.log("Writing config/runtime:");
console.log(JSON.stringify(value, null, 2));

await db.collection("config").doc("runtime").set(value);

// Read back to confirm types survived the round-trip.
const snap = await db.collection("config").doc("runtime").get();
console.log("\nReadback:");
console.log(JSON.stringify(snap.data(), null, 2));

console.log("✓ Done.");
process.exit(0);
