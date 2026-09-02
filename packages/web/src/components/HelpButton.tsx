import { useState } from "react";
import { HelpSheet } from "./HelpSheet.js";

// Floating help pill. Sits above the message input on mobile via bottom-24
// and honours the safe-area inset so it never hides under the iOS home bar.
// z-40 is deliberate: CrisisOverlay renders at z-50 and must always win.
export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Recursos de ayuda"
        className="fixed right-4 z-40 bg-summer-peach text-stone-800 font-secondary font-semibold rounded-full shadow-md hover:scale-[1.02] transition-all flex items-center justify-center gap-2 w-11 h-11 sm:w-auto sm:h-auto sm:px-5 sm:py-3"
        style={{ bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <LifebuoyIcon className="w-5 h-5 flex-shrink-0" />
        <span className="hidden sm:inline text-sm">Ayuda</span>
      </button>

      {open && <HelpSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function LifebuoyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
    </svg>
  );
}
