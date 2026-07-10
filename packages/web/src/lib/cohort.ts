// Non-personal cohort/workshop code capture.
// Persisted to sessionStorage so that navigating from /martina to /session/:id
// preserves the code across the redirect. Read by CoachSession → useCoachSession
// and threaded to the coachTurn callable on the first turn.

const KEY = "salvador.cohortCode";
const MAX_LEN = 120;

// Sanitize: strip whitespace, cap length. We don't restrict character set —
// workshop codes may include Spanish accents or dashes.
function sanitize(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_LEN);
}

export function captureCohortFromUrl(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("c");
  if (raw === null) return null;
  const value = sanitize(raw);
  if (value === null) return null;
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // sessionStorage disabled / quota — fail open, value is lost but no crash.
  }
  return value;
}

export function readCohort(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    return sanitize(raw);
  } catch {
    return null;
  }
}
