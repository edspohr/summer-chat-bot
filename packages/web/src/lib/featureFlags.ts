// Frontend feature flags read from Vite build-time env vars. Keep them here
// so a grep for the constant name lands on the single source of truth.
//
// REPORT_MODE gates the /report/:sessionId page.
//   "formative" (default 2026-09-22) — coaching-shape report from
//                                     coach_feedback_v1, aciertos +
//                                     oportunidades + nextChallenge +
//                                     mentorQuestion. Requires the
//                                     generateSessionReport callable.
//   "minimal"                        — pilot closing UX (pre-Fase 4).
//   "full"                           — pre-pilot report with matched/
//                                     missing competencies breakdown.
// Unset falls back to "formative".

export type ReportMode = "formative" | "minimal" | "full";

function readReportMode(): ReportMode {
  const raw = import.meta.env.VITE_REPORT_MODE;
  if (raw === "minimal") return "minimal";
  if (raw === "full") return "full";
  return "formative";
}

export const REPORT_MODE: ReportMode = readReportMode();
