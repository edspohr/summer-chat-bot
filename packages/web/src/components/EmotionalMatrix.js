import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
function MatrixBar({ label, subLabel, value, max = 10, color, trackColor, ariaLabel, tooltip, isPulsing, delta, showDelta, }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const pct = Math.round((value / max) * 100);
    return (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [_jsxs("div", { children: [_jsx("span", { className: "font-secondary text-xs font-semibold text-stone-700", children: label }), subLabel !== undefined && (_jsx("span", { className: "block font-secondary text-[10px] text-stone-400", children: subLabel }))] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [showDelta && delta !== undefined && delta !== null && (_jsx("span", { className: `font-mono text-[10px] font-bold ${delta === "RESET_ZERO"
                                    ? "text-red-600"
                                    : delta > 0
                                        ? "text-emerald-600"
                                        : delta < 0
                                            ? "text-red-500"
                                            : "text-stone-400"}`, children: delta === "RESET_ZERO" ? "→0" : delta > 0 ? `+${delta}` : delta })), _jsxs("span", { className: "font-secondary text-xs font-bold text-stone-700 tabular-nums", children: [value, _jsx("span", { className: "text-stone-400 font-normal", children: "/10" })] })] })] }), _jsxs("div", { className: "relative", onMouseEnter: () => setShowTooltip(true), onMouseLeave: () => setShowTooltip(false), onFocus: () => setShowTooltip(true), onBlur: () => setShowTooltip(false), children: [_jsx("div", { className: `h-2.5 w-full rounded-full ${trackColor}`, role: "progressbar", "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": value, "aria-label": ariaLabel, children: _jsx("div", { className: `h-full rounded-full ${color} transition-all duration-[400ms] ease-out ${isPulsing ? "animate-matrix-pulse" : ""}`, style: { width: `${pct}%` } }) }), showTooltip && tooltip.length > 0 && (_jsx("div", { className: "absolute bottom-full mb-2 left-0 right-0 bg-stone-800 text-white text-[11px] font-secondary rounded-lg px-3 py-2 z-10 shadow-lg pointer-events-none", role: "tooltip", children: tooltip }))] })] }));
}
export function EmotionalMatrix({ estado, showDeltas = false, deltas = null, razonamientoBreve, changedVar = null, }) {
    const buildTooltip = (varName) => {
        if (changedVar !== varName || razonamientoBreve === undefined)
            return "";
        return razonamientoBreve;
    };
    return (_jsxs("div", { className: "space-y-3 px-1", children: [_jsx(MatrixBar, { label: "Intensidad Emocional", subLabel: "menor es mejor", value: estado.intensidadEmocional, color: "bg-summer-peach", trackColor: "bg-summer-peach/20", ariaLabel: "Intensidad emocional de Martina", tooltip: buildTooltip("intensidadEmocional"), isPulsing: changedVar === "intensidadEmocional", delta: deltas?.intensidadEmocional ?? null, showDelta: showDeltas }), _jsx(MatrixBar, { label: "Apertura", value: estado.apertura, color: "bg-summer-teal", trackColor: "bg-summer-teal/20", ariaLabel: "Apertura de Martina", tooltip: buildTooltip("apertura"), isPulsing: changedVar === "apertura", delta: deltas?.apertura ?? null, showDelta: showDeltas }), _jsx(MatrixBar, { label: "Confianza en la Ayuda", value: estado.confianzaEnLaAyuda, color: "bg-summer-blue", trackColor: "bg-summer-blue/20", ariaLabel: "Confianza de Martina en la ayuda", tooltip: buildTooltip("confianzaEnLaAyuda"), isPulsing: changedVar === "confianzaEnLaAyuda", delta: deltas?.confianzaEnLaAyuda ?? null, showDelta: showDeltas })] }));
}
