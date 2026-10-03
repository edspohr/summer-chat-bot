// Warm-instance scheduler.
//
// 09:00 Mon–Fri (America/Santiago): service-level min instances → 1 on the
// chat-turn services, unless today is a Chilean public holiday.
// 18:00 Mon–Fri: back to 0, always.
//
// REGION EXCEPTION: same as inactivityScheduler.ts — Cloud Scheduler is not
// available in southamerica-west1, so the jobs run in southamerica-east1 and
// patch the southamerica-west1 services over the Cloud Run Admin API. No user
// data is involved.
//
// Config (targets, schedule, holidays): ./warmConfig.ts.
// Runbook and manual override: docs/runbooks/warm-instances.md.

import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  CHILE_HOLIDAYS_COVERED_UNTIL,
  COLD_MIN_INSTANCES,
  COOL_DOWN_SCHEDULE,
  WARM_MIN_INSTANCES,
  WARM_PROJECT_ID,
  WARM_TIME_ZONE,
  WARM_UP_SCHEDULE,
} from "./warmConfig.js";

const SCHEDULER_REGION = "southamerica-east1";

function isWarmProject(): boolean {
  const projectId = process.env["GCLOUD_PROJECT"];
  if (projectId === WARM_PROJECT_ID) return true;
  console.log(`[warm] skipped: project ${projectId ?? "unknown"} is not ${WARM_PROJECT_ID}`);
  return false;
}

export const warmInstancesUp = onSchedule(
  {
    schedule: WARM_UP_SCHEDULE,
    region: SCHEDULER_REGION,
    timeZone: WARM_TIME_ZONE,
    memory: "256MiB",
    timeoutSeconds: 60,
    retryCount: 3,
  },
  async () => {
    if (!isWarmProject()) return;
    const { isChileHoliday, santiagoDate, setAllTargets, defaultWarmDeps } = await import(
      "./warmInstances.js"
    );
    const now = new Date();
    const today = santiagoDate(now);
    if (isChileHoliday(now)) {
      console.log(`[warm] up skipped: ${today} is a public holiday`);
      return;
    }
    if (today > CHILE_HOLIDAYS_COVERED_UNTIL) {
      console.warn(
        `[warm] holiday list only covers until ${CHILE_HOLIDAYS_COVERED_UNTIL} — refresh warmConfig.ts`,
      );
    }
    const results = await setAllTargets(WARM_MIN_INSTANCES, await defaultWarmDeps());
    console.log(`[warm] up ${today}: ${JSON.stringify(results)}`);
  },
);

export const warmInstancesDown = onSchedule(
  {
    schedule: COOL_DOWN_SCHEDULE,
    region: SCHEDULER_REGION,
    timeZone: WARM_TIME_ZONE,
    memory: "256MiB",
    timeoutSeconds: 60,
    retryCount: 3,
  },
  async () => {
    if (!isWarmProject()) return;
    const { santiagoDate, setAllTargets, defaultWarmDeps } = await import("./warmInstances.js");
    const results = await setAllTargets(COLD_MIN_INSTANCES, await defaultWarmDeps());
    console.log(`[warm] down ${santiagoDate(new Date())}: ${JSON.stringify(results)}`);
  },
);
