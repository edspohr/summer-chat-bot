// Frontend feature flags read from Vite build-time env vars. Keep them here
// so a grep for the constant name lands on the single source of truth.
//
// REPORT_MODE gates the /report/:sessionId page. "minimal" is the pilot
// closing UX; "full" preserves the pre-pilot report with matched/missing
// competencies breakdown. Default is "minimal" — an unset or invalid value
// falls back to the safer pilot experience.

export type ReportMode = "minimal" | "full";

function readReportMode(): ReportMode {
  const raw = import.meta.env.VITE_REPORT_MODE;
  return raw === "full" ? "full" : "minimal";
}

export const REPORT_MODE: ReportMode = readReportMode();
