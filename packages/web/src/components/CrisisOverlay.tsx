import type { CrisisMeta, CrisisBranchId } from "@salvador/shared";

interface CrisisOverlayProps {
  // Text of the safety template (REAL_DISTRESS or FRAME_BREAK). Always shown.
  template: string;
  onConfirmResume: () => void;
  canResume: boolean;
  // Phase 4 (A7) — when present, the pedagogical branch UX replaces the legacy
  // single "Estoy listo/a" button. Copy is placeholder pending Camila validation.
  crisisMeta?: CrisisMeta | null;
  onChooseBranch?: (branch: CrisisBranchId) => Promise<void>;
  // Outcome of the branch choice. When set, overlay renders the feedback text
  // (for crisis_exercise) or nothing extra (for crisis_flagged_real) plus a
  // "Ir al informe" button that closes the session flow.
  branchOutcome?: { branch: CrisisBranchId; feedbackText: string | null } | null;
  onGoToReport?: () => void;
}

// User-facing labels for the two branches. English identifiers stay in code;
// Spanish labels render to the trainee.
const BRANCH_LABELS: Record<CrisisBranchId, string> = {
  crisis_exercise: "Era parte del ejercicio",
  crisis_flagged_real: "Es algo real que me está pasando",
};

// Placeholder — final copy comes from Camila (clinical owner).
const PROMPT_TEXT_FALLBACK =
  "Antes de continuar, quiero entender: ¿qué querías explorar con esa frase?";

export function CrisisOverlay({
  template,
  onConfirmResume,
  canResume,
  crisisMeta,
  onChooseBranch,
  branchOutcome,
  onGoToReport,
}: CrisisOverlayProps) {
  const branchingActive = crisisMeta !== undefined && crisisMeta !== null;

  return (
    <div className="fixed inset-0 bg-warm-bg z-50 flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-md w-full space-y-6 my-8">
        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
          <span className="text-teal-600 text-lg">♡</span>
        </div>
        <p className="text-stone-800 whitespace-pre-wrap text-sm leading-relaxed">
          {template}
        </p>

        {!branchingActive && canResume && (
          <button
            onClick={onConfirmResume}
            className="w-full bg-stone-800 hover:bg-stone-900 text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            Estoy listo/a para retomar el entrenamiento
          </button>
        )}

        {branchingActive && (branchOutcome === null || branchOutcome === undefined) && (
          <div className="space-y-4 pt-2 border-t border-stone-200">
            <p className="text-stone-700 text-sm leading-relaxed font-medium">
              {PROMPT_TEXT_FALLBACK}
            </p>
            <div className="space-y-2">
              {crisisMeta.branches.map((b) => (
                <button
                  key={b}
                  onClick={() => void onChooseBranch?.(b)}
                  disabled={onChooseBranch === undefined}
                  className="w-full bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 rounded-xl py-3 px-4 text-sm font-medium text-left transition-colors disabled:opacity-50"
                >
                  {BRANCH_LABELS[b]}
                </button>
              ))}
            </div>
          </div>
        )}

        {branchingActive && branchOutcome !== null && branchOutcome !== undefined && (
          <div className="space-y-4 pt-2 border-t border-stone-200">
            {branchOutcome.feedbackText !== null && (
              <p className="text-stone-700 whitespace-pre-wrap text-sm leading-relaxed">
                {branchOutcome.feedbackText}
              </p>
            )}
            <button
              onClick={onGoToReport}
              disabled={onGoToReport === undefined}
              className="w-full bg-stone-800 hover:bg-stone-900 text-white rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Ir al informe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
