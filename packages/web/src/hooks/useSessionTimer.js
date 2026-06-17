import { useState, useEffect, useRef, useCallback } from "react";
// Warning thresholds in elapsed seconds (shown as suggestions, not hard locks)
const WARN_AT_5MIN = 300;
const WARN_AT_10MIN = 600;
const WARN_AT_15MIN = 900;
function formatMmSs(seconds) {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
}
function toPhase(elapsed) {
    if (elapsed >= WARN_AT_15MIN)
        return "suggest15";
    if (elapsed >= WARN_AT_10MIN)
        return "suggest10";
    if (elapsed >= WARN_AT_5MIN)
        return "suggest5";
    return "running";
}
export function useSessionTimer(onWarning) {
    const [serverStartIso, setServerStartIso] = useState(null);
    const [anulado, setAnulado] = useState(false);
    const firedWarnings = useRef(new Set());
    const computeElapsed = useCallback(() => {
        if (serverStartIso === null)
            return 0;
        return Math.floor((Date.now() - new Date(serverStartIso).getTime()) / 1000);
    }, [serverStartIso]);
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (serverStartIso === null)
            return;
        const tick = () => {
            const e = computeElapsed();
            setElapsed(e);
            if (e >= WARN_AT_5MIN && !firedWarnings.current.has("5min")) {
                firedWarnings.current.add("5min");
                onWarning("5min");
            }
            else if (e >= WARN_AT_10MIN && !firedWarnings.current.has("10min")) {
                firedWarnings.current.add("10min");
                onWarning("10min");
            }
            else if (e >= WARN_AT_15MIN && !firedWarnings.current.has("15min")) {
                firedWarnings.current.add("15min");
                onWarning("15min");
            }
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [serverStartIso, computeElapsed, onWarning]);
    const syncFromServer = useCallback((timerState) => {
        if (timerState.sesionIniciadaEn !== null) {
            setServerStartIso(timerState.sesionIniciadaEn);
        }
        setAnulado(timerState.cronometroAnulado);
    }, []);
    const phase = serverStartIso === null ? "idle" : toPhase(elapsed);
    return {
        phase,
        displayMmSs: formatMmSs(elapsed),
        elapsedSeconds: elapsed,
        cronometroAnulado: anulado,
        syncFromServer,
    };
}
