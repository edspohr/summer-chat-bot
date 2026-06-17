import type { TagProgressItem } from "@salvador/shared";

// PRIVACY RULE: This component receives ONLY tagId and completed status.
// It NEVER receives tag names, definitions, criteria, confidence scores,
// justifications, or evaluatorOutput. Exposing those fields would destroy
// the training value of the Coach mode.
interface TagProgressProps {
  items: TagProgressItem[];
}

export function TagProgress({ items }: TagProgressProps) {
  const completed = items.filter((i) => i.completed).length;

  return (
    <div className="flex flex-col gap-1" aria-label="Progreso de la sesión">
      <div className="flex gap-1">
        {items.map((item) => (
          <div
            key={item.tagId}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              item.completed ? "bg-teal-500" : "bg-stone-200"
            }`}
            role="progressbar"
            aria-valuenow={item.completed ? 1 : 0}
            aria-valuemin={0}
            aria-valuemax={1}
          />
        ))}
      </div>
      <p className="text-xs text-stone-400 text-right">
        {completed} / {items.length}
      </p>
    </div>
  );
}
