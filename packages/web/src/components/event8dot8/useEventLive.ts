import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { EVENT_8DOT8, OASIS_PHASES_IN_ORDER, type EventLiveDoc, type OasisPhase } from "@salvador/shared";
import { db } from "../../firebase.js";

export const EMPTY_EVENT_LIVE: EventLiveDoc = {
  sessions: 0,
  listenSeconds: 0,
  oasisTags: 0,
  phaseSessionPct: Object.fromEntries(OASIS_PHASES_IN_ORDER.map((p) => [p, 0])) as Record<OasisPhase, number>,
  matrixFinalAvg: null,
  recentActivity: [],
  updatedAtMs: 0,
};

const RETRY_MS = 3000;

// Subscribes to the single public aggregate doc. On listener error, flags
// `reconnecting` and resubscribes after RETRY_MS until it succeeds.
export function useEventLive(enabled: boolean): { data: EventLiveDoc; reconnecting: boolean } {
  const [data, setData] = useState<EventLiveDoc>(EMPTY_EVENT_LIVE);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let unsub: (() => void) | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const subscribe = (): void => {
      unsub = onSnapshot(
        doc(db, EVENT_8DOT8.liveCollection, EVENT_8DOT8.liveDocId),
        (snap) => {
          setReconnecting(false);
          setData(snap.exists() ? { ...EMPTY_EVENT_LIVE, ...(snap.data() as Partial<EventLiveDoc>) } : EMPTY_EVENT_LIVE);
        },
        () => {
          setReconnecting(true);
          unsub?.();
          unsub = null;
          if (!cancelled) retry = setTimeout(subscribe, RETRY_MS);
        },
      );
    };
    subscribe();

    return () => {
      cancelled = true;
      if (retry !== null) clearTimeout(retry);
      unsub?.();
    };
  }, [enabled]);

  return { data, reconnecting };
}

// Realistic fake data for ?demo=1. Never touches Firestore. Drifts upward
// every few seconds so the number animations can be checked.
export function useDemoEventLive(enabled: boolean): EventLiveDoc {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [enabled]);

  const now = Date.now();
  return {
    sessions: 47 + tick,
    listenSeconds: 9420 + tick * 260,
    oasisTags: 212 + tick * 4,
    phaseSessionPct: { OBSERVA: 89, ACOGE: 76, SILENCIO: 41 + (tick % 5), ILUMINA: 58, SOSTEN: 34 + (tick % 3) },
    matrixFinalAvg: { intensidadEmocional: 3.4, apertura: 7.8, confianzaEnLaAyuda: 6.9, n: 31 },
    recentActivity: Array.from({ length: 4 + (tick % 4) }, (_, i) => now - i * 25_000),
    updatedAtMs: now,
  };
}
