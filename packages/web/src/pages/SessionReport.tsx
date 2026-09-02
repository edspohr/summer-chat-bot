import SessionReportFull from "./SessionReportFull.js";

// Thin wrapper. Commit 1 keeps behaviour identical by always rendering the
// legacy full report. Commit 2 introduces the REPORT_MODE switch that also
// mounts SessionReportMinimal.
export default function SessionReport() {
  return <SessionReportFull />;
}
