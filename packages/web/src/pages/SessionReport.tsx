import { REPORT_MODE } from "../lib/featureFlags.js";
import SessionReportFull from "./SessionReportFull.js";
import SessionReportMinimal from "./SessionReportMinimal.js";

export default function SessionReport() {
  return REPORT_MODE === "full" ? <SessionReportFull /> : <SessionReportMinimal />;
}
