import { useState } from "react";
import type { EstadoMatriz } from "@salvador/shared";

type MatrixVarKey = "intensidadEmocional" | "apertura" | "confianzaEnLaAyuda";

interface EmotionalMatrixProps {
  estado: EstadoMatriz;
  showDeltas?: boolean;
  deltas?: {
    intensidadEmocional: number;
    apertura: number;
    confianzaEnLaAyuda: number | "RESET_ZERO";
  } | null;
  razonamientoBreve?: string;
  // Set of variables that changed this turn (all pulse simultaneously)
  changedVars?: ReadonlySet<MatrixVarKey>;
  // Per-variable directional cue: "good" | "bad" | "none"
  deltaSign?: Record<MatrixVarKey, "good" | "bad" | "none">;
  // Legacy single-var prop kept for LabChat compatibility
  changedVar?: MatrixVarKey | null;
  // Compact horizontal layout for mobile floating bar (A3). Hides labels.
  variant?: "full" | "compact";
}

interface BarProps {
  label: string;
  subLabel?: string;
  value: number;
  max?: number;
  color: string;
  trackColor: string;
  ariaLabel: string;
  tooltip: string;
  isPulsing: boolean;
  direction: "good" | "bad" | "none";
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
  direction,
  delta,
  showDelta,
}: BarProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const pct = Math.round((value / max) * 100);

  // During pulse: override fill color with a directional cue.
  // "good" → emerald flash; "bad" → rose flash; "none" → default color.
  const fillColor =
    isPulsing && direction === "good"
      ? "bg-emerald-400"
      : isPulsing && direction === "bad"
      ? "bg-rose-400"
      : color;

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
            className={`h-full rounded-full ${fillColor} transition-all duration-[400ms] ease-out ${
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

const EMPTY_SET: ReadonlySet<MatrixVarKey> = new Set();
const DEFAULT_SIGNS: Record<MatrixVarKey, "good" | "bad" | "none"> = {
  intensidadEmocional: "none",
  apertura: "none",
  confianzaEnLaAyuda: "none",
};

interface CompactBarProps {
  shortLabel: string;
  value: number;
  color: string;
  trackColor: string;
  ariaLabel: string;
  isPulsing: boolean;
  direction: "good" | "bad" | "none";
}

function CompactMatrixBar({
  shortLabel,
  value,
  color,
  trackColor,
  ariaLabel,
  isPulsing,
  direction,
}: CompactBarProps) {
  const pct = Math.round((value / 10) * 100);
  const fillColor =
    isPulsing && direction === "good"
      ? "bg-emerald-400"
      : isPulsing && direction === "bad"
      ? "bg-rose-400"
      : color;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-secondary text-[10px] font-semibold text-stone-600 truncate">
          {shortLabel}
        </span>
        <span className="font-secondary text-[10px] font-bold text-stone-700 tabular-nums flex-shrink-0 ml-1">
          {value}
        </span>
      </div>
      <div
        className={`h-1.5 w-full rounded-full ${trackColor}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={value}
        aria-label={ariaLabel}
      >
        <div
          className={`h-full rounded-full ${fillColor} transition-all duration-[400ms] ease-out ${
            isPulsing ? "animate-matrix-pulse" : ""
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function EmotionalMatrix({
  estado,
  showDeltas = false,
  deltas = null,
  razonamientoBreve,
  changedVars,
  deltaSign,
  changedVar = null,
  variant = "full",
}: EmotionalMatrixProps) {
  // Support legacy changedVar prop (LabChat) by converting to a Set
  const activeVars: ReadonlySet<MatrixVarKey> =
    changedVars !== undefined
      ? changedVars
      : changedVar !== null
      ? new Set([changedVar])
      : EMPTY_SET;

  const signs = deltaSign ?? DEFAULT_SIGNS;

  if (variant === "compact") {
    return (
      <div className="flex gap-3 px-2 py-2">
        <CompactMatrixBar
          shortLabel="Intensidad"
          value={estado.intensidadEmocional}
          color="bg-summer-peach"
          trackColor="bg-summer-peach/20"
          ariaLabel="Intensidad emocional de Martina"
          isPulsing={activeVars.has("intensidadEmocional")}
          direction={signs.intensidadEmocional}
        />
        <CompactMatrixBar
          shortLabel="Apertura"
          value={estado.apertura}
          color="bg-summer-teal"
          trackColor="bg-summer-teal/20"
          ariaLabel="Apertura de Martina"
          isPulsing={activeVars.has("apertura")}
          direction={signs.apertura}
        />
        <CompactMatrixBar
          shortLabel="Confianza"
          value={estado.confianzaEnLaAyuda}
          color="bg-summer-blue"
          trackColor="bg-summer-blue/20"
          ariaLabel="Confianza de Martina en la ayuda"
          isPulsing={activeVars.has("confianzaEnLaAyuda")}
          direction={signs.confianzaEnLaAyuda}
        />
      </div>
    );
  }

  const buildTooltip = (varName: MatrixVarKey): string => {
    if (!activeVars.has(varName) || razonamientoBreve === undefined) return "";
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
        isPulsing={activeVars.has("intensidadEmocional")}
        direction={signs.intensidadEmocional}
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
        isPulsing={activeVars.has("apertura")}
        direction={signs.apertura}
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
        isPulsing={activeVars.has("confianzaEnLaAyuda")}
        direction={signs.confianzaEnLaAyuda}
        delta={deltas?.confianzaEnLaAyuda ?? null}
        showDelta={showDeltas}
      />
    </div>
  );
}
