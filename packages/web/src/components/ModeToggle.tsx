import type { SimulationMode } from "@salvador/shared";

interface ModeToggleProps {
  value: SimulationMode;
  onChange: (mode: SimulationMode) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{
  value: SimulationMode;
  label: string;
  subLabel: string;
}> = [
  {
    value: "escenario",
    label: "Modo Escenario · Martina",
    subLabel: "Conversación con el personaje completo y todas las reglas del escenario.",
  },
  {
    value: "promptPuro",
    label: "Modo Prompt Puro",
    subLabel: "Conversación con la lógica base del modelo, sin escenario cargado. Para validación experta.",
  },
];

export function ModeToggle({ value, onChange, disabled = false }: ModeToggleProps) {
  function handleChange(newMode: SimulationMode) {
    if (newMode === value || disabled) return;
    const confirmed = window.confirm(
      "Si cambias de modo, se descartará la conversación actual. ¿Continuar?"
    );
    if (confirmed) onChange(newMode);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Modo de simulación
      </p>
      <div className="flex flex-col gap-1.5">
        {OPTIONS.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => handleChange(opt.value)}
              className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed ${
                isSelected
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              aria-pressed={isSelected}
            >
              <span className="font-semibold block">{opt.label}</span>
              <span className="text-gray-500 mt-0.5 block leading-snug">{opt.subLabel}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400">Cambiar de modo reinicia la conversación.</p>
    </div>
  );
}
