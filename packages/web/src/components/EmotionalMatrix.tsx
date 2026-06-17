import { useState } from "react";
import type { EstadoMatriz } from "@salvador/shared";

interface EmotionalMatrixProps {
  estado: EstadoMatriz;
  // When true, show raw numeric deltas for debugging (admin surface)
  showDeltas?: boolean;
  deltas?: {
    intensidadEmocional: number;
    apertura: number;
    confianzaEnLaAyuda: number | "RESET_ZERO";
  } | null;
  // The short explanation from the evaluator, shown in tooltips
  razonamientoBreve?: string;
  // Which variable changed most recently (for pulse animation)
  changedVar?: "intensidadEmocional" | "apertura" | "confianzaEnLaAyuda" | null;
}

interface BarProps {
  label: string;
  subLabel?: string;
  value: number;
  max?: number;
  color: string; // Tailwind bg-* class for the filled portion
  trackColor: string; // Tailwind bg-* class for the track
  ariaLabel: string;
  tooltip: string;
  isPulsing: boolean;
  delta?: number | "RESET_ZERO" | null;
  showDelta: boolean;
}

function MatrixBar({
  label,
  subLabel,
  value,
  max = 10,
  color,
  trackColor,
  ariaLabel,
  tooltip,
  isPulsing,
  delta,
  showDelta,
}: BarProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const pct = Math.round((value / max) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <span className="font-secondary text-xs font-semibold text-stone-700">{label}</span>
          {subLabel !== undefined && (
            <span className="block font-secondary text-[10px] text-stone-400">{subLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {showDelta && delta !== undefined && delta !== null && (
            <span
              className={`font-mono text-[10px] font-bold ${
                delta === "RESET_ZERO"
                  ? "text-red-600"
                  : delta > 0
                  ? "text-emerald-600"
                  : delta < 0
                  ? "text-red-500"
                  : "text-stone-400"
              }`}
            >
              {delta === "RESET_ZERO" ? "→0" : delta > 0 ? `+${delta}` : delta}
            </span>
          )}
          <span className="font-secondary text-xs font-bold text-stone-700 tabular-nums">
            {value}
            <span className="text-stone-400 font-normal">/10</span>
          </span>
        </div>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <div
          className={`h-2.5 w-full rounded-full ${trackColor}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={ariaLabel}
        >
          <div
            className={`h-full rounded-full ${color} transition-all duration-[400ms] ease-out ${
              isPulsing ? "animate-matrix-pulse" : ""
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {showTooltip && tooltip.length > 0 && (
          <div
            className="absolute bottom-full mb-2 left-0 right-0 bg-stone-800 text-white text-[11px] font-secondary rounded-lg px-3 py-2 z-10 shadow-lg pointer-events-none"
            role="tooltip"
          >
            {tooltip}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmotionalMatrix({
  estado,
  showDeltas = false,
  deltas = null,
  razonamientoBreve,
  changedVar = null,
}: EmotionalMatrixProps) {
  const buildTooltip = (varName: string): string => {
    if (changedVar !== varName || razonamientoBreve === undefined) return "";
    return razonamientoBreve;
  };

  return (
    <div className="space-y-3 px-1">
      <MatrixBar
        label="Intensidad Emocional"
        subLabel="menor es mejor"
        value={estado.intensidadEmocional}
        color="bg-summer-peach"
        trackColor="bg-summer-peach/20"
        ariaLabel="Intensidad emocional de Martina"
        tooltip={buildTooltip("intensidadEmocional")}
        isPulsing={changedVar === "intensidadEmocional"}
        delta={deltas?.intensidadEmocional ?? null}
        showDelta={showDeltas}
      />
      <MatrixBar
        label="Apertura"
        value={estado.apertura}
        color="bg-summer-teal"
        trackColor="bg-summer-teal/20"
        ariaLabel="Apertura de Martina"
        tooltip={buildTooltip("apertura")}
        isPulsing={changedVar === "apertura"}
        delta={deltas?.apertura ?? null}
        showDelta={showDeltas}
      />
      <MatrixBar
        label="Confianza en la Ayuda"
        value={estado.confianzaEnLaAyuda}
        color="bg-summer-blue"
        trackColor="bg-summer-blue/20"
        ariaLabel="Confianza de Martina en la ayuda"
        tooltip={buildTooltip("confianzaEnLaAyuda")}
        isPulsing={changedVar === "confianzaEnLaAyuda"}
        delta={deltas?.confianzaEnLaAyuda ?? null}
        showDelta={showDeltas}
      />
    </div>
  );
}
