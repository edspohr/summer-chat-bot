export { mentorChat } from "./mentor/mentorHandler.js";
export { coachTurn, timerOverride, crisisBranch } from "./coach/coachHandler.js";
export { inactivityScan } from "./session/inactivityScheduler.js";
export { analyticsRollupDaily } from "./analytics/rollupScheduler.js";

// Dev-only — deploys to summer-chatbot-dev only. Never expose to production.
import { onCall } from "firebase-functions/v2/https";
import { labChatHandler } from "./lab/labChatHandler.js";
export const labChat = onCall(
  { region: "southamerica-west1", invoker: "public" },
  labChatHandler
);
