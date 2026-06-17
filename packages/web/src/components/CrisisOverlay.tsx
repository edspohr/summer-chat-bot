interface CrisisOverlayProps {
  template: string;
  onConfirmResume: () => void;
  canResume: boolean;
}

// Shown when safety layer activates. Covers chat completely, disables input.
// The "resume" button is only enabled after explicit user confirmation.
export function CrisisOverlay({
  template,
  onConfirmResume,
  canResume,
}: CrisisOverlayProps) {
  return (
    <div className="fixed inset-0 bg-warm-bg z-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
          <span className="text-teal-600 text-lg">♡</span>
        </div>
        <p className="text-stone-800 whitespace-pre-wrap text-sm leading-relaxed">
          {template}
        </p>
        {canResume && (
          <button
            onClick={onConfirmResume}
            className="w-full bg-stone-800 hover:bg-stone-900 text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            Estoy listo/a para retomar el entrenamiento
          </button>
        )}
      </div>
    </div>
  );
}
