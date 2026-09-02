import { useEffect, useState } from "react";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import type { EstadoMatriz } from "@salvador/shared";
import { db } from "../firebase.js";

export interface SessionReportData {
  loading: boolean;
  // ISO-8601 (or null when the trainee never sent a first turn — happens only
  // if the doc exists but sesionIniciadaEn was never written).
  sesionIniciadaEnIso: string | null;
  // Falls back to lastActivityAt when the session doc is missing endedAt
  // (e.g. abandoned session with no explicit close).
  endedAtIso: string | null;
  estadoMatriz: EstadoMatriz | null;
  // Count of role === "user" messages. Preferred over session.turnCount,
  // which also increments on assistant nudges and welcome messages.
  userTurnCount: number;
}

// Firestore Timestamp shape we care about; we don't import firebase-admin
// types into web. `toDate` is the only method we touch.
interface MaybeTimestamp {
  toDate?: () => Date;
  seconds?: number;
}

function timestampToIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  const ts = value as MaybeTimestamp;
  if (typeof ts.toDate === "function") {
    return ts.toDate().toISOString();
  }
  if (typeof ts.seconds === "number") {
    return new Date(ts.seconds * 1000).toISOString();
  }
  return null;
}

// One-time load, not a listener — the report page is post-session and the
// underlying data does not mutate. Both queries hit rules the trainee already
// satisfies (firestore.rules:34 for sessions/{id}, :42-43 for messages).
export function useSessionReportData(sessionId: string): SessionReportData {
  const [data, setData] = useState<SessionReportData>({
    loading: true,
    sesionIniciadaEnIso: null,
    endedAtIso: null,
    estadoMatriz: null,
    userTurnCount: 0,
  });

  useEffect(() => {
    if (sessionId === "") {
      setData((d) => ({ ...d, loading: false }));
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const [sessionSnap, userMsgSnap] = await Promise.all([
          getDoc(doc(db, "sessions", sessionId)),
          getDocs(
            query(
              collection(db, "sessions", sessionId, "messages"),
              where("role", "==", "user"),
            ),
          ),
        ]);
        if (cancelled) return;

        const sessionData = sessionSnap.exists() ? sessionSnap.data() : {};
        const sesionIniciadaEnIso = timestampToIso(sessionData["sesionIniciadaEn"]);
        const endedAtIso =
          timestampToIso(sessionData["endedAt"]) ??
          timestampToIso(sessionData["completedAt"]) ??
          timestampToIso(sessionData["lastActivityAt"]);
        const estadoMatriz = (sessionData["estadoMatriz"] as EstadoMatriz | null) ?? null;

        setData({
          loading: false,
          sesionIniciadaEnIso,
          endedAtIso,
          estadoMatriz,
          userTurnCount: userMsgSnap.size,
        });
      } catch (err) {
        // Report page must never crash — degrade gracefully.
        console.error("[useSessionReportData] load failed", err);
        if (!cancelled) setData((d) => ({ ...d, loading: false }));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return data;
}
