// 8.8 Unreal (Santiago, Oct 2026) — booth live dashboard contract.
// The aggregate doc is publicly readable (see firestore.rules), so it must
// only ever carry counters, averages and bare timestamps: no session ids,
// no user ids, no text.

import type { OasisPhase } from "../schemas/tag.schema.js";

export const EVENT_8DOT8 = {
  source: "8dot8",
  // Chile is on UTC-3 (summer time) for the whole event window.
  startIso: "2026-10-01T00:00:00-03:00",
  endIso: "2026-10-02T23:59:59-03:00",
  liveCollection: "event_live",
  liveDocId: "8dot8",
} as const;

export type SessionSource = typeof EVENT_8DOT8.source;

// Display labels for the OASIS phases (letter = first char of the enum value).
export const OASIS_PHASE_LABELS: Record<OasisPhase, string> = {
  OBSERVA: "Observa",
  ACOGE: "Acoge",
  SILENCIO: "Silencio",
  ILUMINA: "Ilumina",
  SOSTEN: "Sostén",
};

export interface EventLiveMatrixAvg {
  intensidadEmocional: number;
  apertura: number;
  confianzaEnLaAyuda: number;
  n: number;
}

export interface EventLiveDoc {
  sessions: number;
  listenSeconds: number;
  oasisTags: number;
  // 0..100, keyed by OasisPhase
  phaseSessionPct: Record<OasisPhase, number>;
  matrixFinalAvg: EventLiveMatrixAvg | null;
  // Epoch-ms of lastUserActivityAt for sessions active in the last 10 min.
  // Bare numbers only — the dashboard counts those within 3 min.
  recentActivity: number[];
  updatedAtMs: number;
}
