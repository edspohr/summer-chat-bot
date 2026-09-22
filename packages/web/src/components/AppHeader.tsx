import { Link } from "react-router-dom";
import { PRODUCT_NAME } from "@salvador/shared";
import { HelpButton } from "./HelpButton.js";

interface AppHeaderProps {
  /** Text destination for the back arrow ("Inicio", "Escenarios"). */
  backLabel: string;
  backTo: string;
  /** Optional title shown between the back arrow and the help button. */
  title?: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** Suppress the floating HelpButton when the page renders its own. */
  suppressFloatingHelp?: boolean;
}

// AppShell v1 — unified header applied to Report / Mentor / Coach.
// Chat pages that carry a lot of header chrome (Coach's timer + matrix bars)
// keep their custom header; this one is for informational pages.
export function AppHeader({
  backLabel,
  backTo,
  title,
  subtitle,
  suppressFloatingHelp,
}: AppHeaderProps) {
  return (
    <>
      <header className="px-4 sm:px-6 py-4 border-b border-stone-100 bg-white flex items-center gap-3 shadow-sm relative z-10">
        <Link
          to={backTo}
          className="flex items-center gap-1 px-3 h-10 rounded-full text-stone-500 hover:text-summer-blue hover:bg-summer-blue/10 transition-colors text-sm font-secondary"
          aria-label={`Volver a ${backLabel}`}
        >
          <span aria-hidden="true">←</span>
          <span>{backLabel}</span>
        </Link>
        <div className="flex-1 min-w-0 text-center">
          <p className="font-title uppercase tracking-wide text-stone-800 text-xs sm:text-sm truncate">
            {title ?? PRODUCT_NAME}
          </p>
          {subtitle !== undefined && (
            <p className="font-secondary text-[11px] sm:text-xs text-stone-500 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {/* Right-side spacer keeps the title centered against the back arrow. */}
        <div className="w-24 sm:w-28" aria-hidden="true" />
      </header>
      {suppressFloatingHelp !== true && <HelpButton />}
    </>
  );
}
