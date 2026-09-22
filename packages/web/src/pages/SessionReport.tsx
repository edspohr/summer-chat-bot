import { REPORT_MODE } from "../lib/featureFlags.js";
import SessionReportFull from "./SessionReportFull.js";
import SessionReportMinimal from "./SessionReportMinimal.js";
import SessionReportFormative from "./SessionReportFormative.js";

export default function SessionReport() {
  if (REPORT_MODE === "full") return <SessionReportFull />;
  if (REPORT_MODE === "minimal") return <SessionReportMinimal />;
  return <SessionReportFormative />;
}
