import { useEffect, useRef } from "react";
import { HELP_RESOURCES, type HelpResource } from "../lib/helpResources.js";

interface HelpSheetProps {
  onClose: () => void;
}

// Bottom sheet on mobile, side card on desktop. Dismissible via close button,
// Escape or click on the backdrop. Does NOT alter session state — pure info.
export function HelpSheet({ onClose }: HelpSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-end sm:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-sheet-title"
    >
      <button
        type="button"
        aria-label="Cerrar recursos de ayuda"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/40"
      />

      <div
        className="relative w-full sm:w-96 sm:max-w-sm bg-warm-bg rounded-t-3xl sm:rounded-3xl shadow-md p-6 sm:m-4 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2
              id="help-sheet-title"
              className="font-title uppercase tracking-wide text-summer-blue text-lg"
            >
              Recursos de ayuda
            </h2>
            <p className="font-secondary text-sm text-stone-600 mt-1 leading-relaxed">
              Si tú o alguien cercano necesita apoyo ahora, estos canales están disponibles.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-stone-400 hover:text-stone-700 text-2xl leading-none flex-shrink-0 transition-colors"
          >
            ×
          </button>
        </div>

        <ul className="space-y-3">
          {HELP_RESOURCES.map((r) => (
            <li key={r.name}>
              <ResourceRow resource={r} />
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full bg-summer-blue text-white rounded-full py-3 font-secondary font-semibold text-sm hover:scale-[1.02] transition-all shadow-sm"
        >
          Volver a la sesión
        </button>
      </div>
    </div>
  );
}

function ResourceRow({ resource }: { resource: HelpResource }) {
  const commonClasses =
    "block rounded-2xl border border-stone-200 bg-white px-4 py-3 hover:border-summer-blue/50 hover:shadow-sm transition-all";

  if (resource.kind === "phone") {
    return (
      <a href={`tel:${resource.tel}`} className={commonClasses}>
        <p className="font-secondary font-semibold text-summer-blue text-sm">{resource.name}</p>
        <p className="font-secondary text-xs text-stone-600 mt-1 leading-relaxed">{resource.detail}</p>
      </a>
    );
  }

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className={commonClasses}
    >
      <p className="font-secondary font-semibold text-summer-blue text-sm">{resource.name}</p>
      <p className="font-secondary text-xs text-stone-600 mt-1 leading-relaxed">{resource.detail}</p>
    </a>
  );
}
