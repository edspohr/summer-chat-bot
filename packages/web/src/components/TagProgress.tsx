import type { TagProgressItem } from "@salvador/shared";

// PRIVACY RULE: This component receives ONLY tagId and completed status.
// It NEVER receives tag names, definitions, criteria, confidence scores,
// justifications, or evaluatorOutput. Exposing those fields would destroy
// the training value of the Coach mode.
interface TagProgressProps {
  items: TagProgressItem[];
}

const TAG_LABELS: Record<string, string> = {
  T_01_OBSERVA_SENALES_S03:        "Señales",
  T_02_OBSERVA_NO_JUICIO_S03:      "No-juicio",
  T_03_ACOGE_VALIDACION_S03:       "Validación",
  T_04_ACOGE_PREGUNTA_DIRECTA_S03: "Pregunta",
  T_05_SILENCIO_PRESENCIA_S03:     "Presencia",
  T_06_ILUMINA_RECURSOS_S03:       "Recursos",
  T_07_SOSTEN_RED_S03:             "Red",
  T_08_SOSTEN_REDES_OFICIALES_S03: "Derivación",
};

function shortLabel(tagId: string): string {
  return TAG_LABELS[tagId] ?? tagId;
}

export function TagProgress({ items }: TagProgressProps) {
  const completed = items.filter((i) => i.completed).length;

  return (
    <div className="flex flex-col gap-1" aria-label="Progreso de la sesión">
      <div className="flex gap-1 items-end">
        {items.map((item) => (
          <div key={item.tagId} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
            <span className={`text-[9px] font-secondary leading-tight text-center truncate w-full transition-colors ${
              item.completed ? "text-teal-600 font-semibold" : "text-stone-300"
            }`}>
              {shortLabel(item.tagId)}
            </span>
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${
                item.completed ? "bg-teal-500" : "bg-stone-200"
              }`}
              role="progressbar"
              aria-valuenow={item.completed ? 1 : 0}
              aria-valuemin={0}
              aria-valuemax={1}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-400 text-right">
        {completed} / {items.length}
      </p>
    </div>
  );
}
