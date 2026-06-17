import type { TagProgressItem } from "@salvador/shared";

// PRIVACY RULE: This component receives ONLY tagId and completed status.
// It NEVER receives tag names, definitions, criteria, confidence scores,
// justifications, or evaluatorOutput. Exposing those fields would destroy
// the training value of the Coach mode.
interface TagProgressProps {
  items: TagProgressItem[];
}

// Derives a short human-readable hint from the tagId convention:
// "T_03_ACOGE_VALIDACION_S03" → "Validación"
function shortLabel(tagId: string): string {
  const PHASE_WORDS = new Set(["OBSERVA", "ACOGE", "SILENCIO", "ILUMINA", "SOSTEN"]);
  const parts = tagId.split("_");
  // Find the first part after the phase word that isn't a scenario suffix (Sxx)
  let found = false;
  for (const part of parts) {
    if (PHASE_WORDS.has(part)) { found = true; continue; }
    if (found && !/^S\d+$/.test(part)) {
      // Title-case and replace common abbreviations
      const word = part.charAt(0) + part.slice(1).toLowerCase();
      const MAP: Record<string, string> = {
        Senales: "Señales",
        Juicio: "Sin juicio",
        Validacion: "Validación",
        Pregunta: "Pregunta",
        Presencia: "Presencia",
        Recursos: "Recursos",
        Red: "Red",
        Redes: "Derivación",
      };
      return MAP[word] ?? word;
    }
  }
  return tagId;
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
