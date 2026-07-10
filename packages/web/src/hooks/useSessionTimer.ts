import { useState, useEffect, useRef, useCallback } from "react";
import type { TimerState } from "@salvador/shared";

// Warning thresholds in elapsed seconds (shown as suggestions, not hard locks).
// The 10-min mark still changes the timer chip color (see toPhase) but no
// longer surfaces a toast.
const WARN_AT_5MIN = 300;
const WARN_AT_10MIN = 600;
const WARN_AT_15MIN = 900;

export type TimerPhase = "idle" | "running" | "suggest5" | "suggest10" | "suggest15";

export interface SessionTimerHookResult {
  phase: TimerPhase;
  displayMmSs: string;
  elapsedSeconds: number;
  cronometroAnulado: boolean;
  syncFromServer: (timerState: TimerState) => void;
}

function formatMmSs(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
}

function toPhase(elapsed: number): TimerPhase {
  if (elapsed >= WARN_AT_15MIN) return "suggest15";
  if (elapsed >= WARN_AT_10MIN) return "suggest10";
  if (elapsed >= WARN_AT_5MIN) return "suggest5";
  return "running";
}

export function useSessionTimer(
  onWarning: (at: "5min" | "15min") => void,
): SessionTimerHookResult {
  const [serverStartIso, setServerStartIso] = useState<string | null>(null);
  const [anulado, setAnulado] = useState(false);
  const firedWarnings = useRef<Set<string>>(new Set());

  const computeElapsed = useCallback((): number => {
    if (serverStartIso === null) return 0;
    return Math.floor((Date.now() - new Date(serverStartIso).getTime()) / 1000);
  }, [serverStartIso]);

  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (serverStartIso === null) return;

    const tick = () => {
      const e = computeElapsed();
      setElapsed(e);

      // 5 min suggests going to the report; 15 min repeats that suggestion
      // more urgently. 10 min no longer fires a toast — the visual timer
      // phase change still colors the chip so the trainee sees progress.
      if (e >= WARN_AT_5MIN && !firedWarnings.current.has("5min")) {
        firedWarnings.current.add("5min");
        onWarning("5min");
      } else if (e >= WARN_AT_15MIN && !firedWarnings.current.has("15min")) {
        firedWarnings.current.add("15min");
        onWarning("15min");
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [serverStartIso, computeElapsed, onWarning]);

  const syncFromServer = useCallback((timerState: TimerState) => {
    if (timerState.sesionIniciadaEn !== null) {
      setServerStartIso(timerState.sesionIniciadaEn);
    }
    setAnulado(timerState.cronometroAnulado);
  }, []);

  const phase: TimerPhase = serverStartIso === null ? "idle" : toPhase(elapsed);

  return {
    phase,
    displayMmSs: formatMmSs(elapsed),
    elapsedSeconds: elapsed,
    cronometroAnulado: anulado,
    syncFromServer,
  };
}
