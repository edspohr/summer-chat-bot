// Entry-channel capture (?src=8dot8 from the 8.8 Unreal booth QR).
// Same sessionStorage pattern as cohort.ts so it survives the /martina →
// /session/:id redirect. Allow-listed: unknown values are ignored.

const KEY = "salvador.source";
const ALLOWED = new Set(["8dot8"]);

export type SessionSource = "8dot8";

export function captureSourceFromUrl(searchParams: URLSearchParams): void {
  const raw = searchParams.get("src");
  if (raw === null || !ALLOWED.has(raw)) return;
  try {
    sessionStorage.setItem(KEY, raw);
  } catch {
    // sessionStorage disabled — fail open.
  }
}

export function readSource(): SessionSource | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw === "8dot8" ? raw : null;
  } catch {
    return null;
  }
}
