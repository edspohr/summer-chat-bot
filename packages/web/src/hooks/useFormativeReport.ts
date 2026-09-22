// Reads the formative report from `sessions/{id}.formativeReport` in
// realtime + triggers `generateSessionReport` as a fallback if the field
// is missing at mount (SessionClosingScreen fires it as a prefetch, so
// this fallback usually finds a "ready" report already).
//
// Never throws to the UI. Every failure resolves to a valid envelope.

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { FormativeReport } from "@salvador/shared";
import { db } from "../firebase.js";
import { callGenerateSessionReport } from "../lib/functions.js";

export interface UseFormativeReportResult {
  /** Server-known report. `null` until the first Firestore snapshot resolves. */
  report: FormativeReport | null;
  /** Whether the Firestore listener has settled at least once. */
  loaded: boolean;
  /** Set when the fallback callable itself errored (network, permission). */
  error: string | null;
}

export function useFormativeReport(sessionId: string): UseFormativeReportResult {
  const [report, setReport] = useState<FormativeReport | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId === "") {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    let triggeredFallback = false;

    const unsub = onSnapshot(
      doc(db, "sessions", sessionId),
      (snap) => {
        if (cancelled) return;
        const data = snap.data();
        const current = (data?.formativeReport as FormativeReport | undefined) ?? null;
        setReport(current);
        setLoaded(true);

        // Fallback: nothing on the doc → the prefetch never fired (or the
        // session was closed before it could). Trigger once.
        if (current === null && !triggeredFallback) {
          triggeredFallback = true;
          callGenerateSessionReport({ sessionId })
            .catch((err: unknown) => {
              if (cancelled) return;
              setError(err instanceof Error ? err.message : String(err));
            });
        }
      },
      (err) => {
        if (cancelled) return;
        setError(err.message);
        setLoaded(true);
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [sessionId]);

  return { report, loaded, error };
}
