// Pure builder for the inactivity nudge. Lives in its own file so the vitest
// suite can exercise it without importing `config/firebase.ts` (debt-0021).
//
// The message written to Firestore carries `meta.isNudge: true`; rollupBuilder
// and export-pilot-data filter on that flag to count nudges vs regular
// assistant turns. This helper is the single source of truth for the flag.

export const NUDGE_CONTENT = "¿Profe, sigue ahí?";
export const NUDGE_PROMPT_VERSION = "coach_conversational_v1";

export function buildNudgeMessageArgs(
  sessionId: string,
  turnCount: number
): {
  sessionId: string;
  role: "assistant";
  content: string;
  turnNumber: number;
  promptVersion: string;
  meta: { isNudge: true };
} {
  return {
    sessionId,
    role: "assistant",
    content: NUDGE_CONTENT,
    // The nudge counts as an assistant turn. turnNumber = turnCount + 1 keeps
    // the message subcollection monotonic; the user's next reply increments
    // turnCount naturally through appendMessage.
    turnNumber: turnCount + 1,
    promptVersion: NUDGE_PROMPT_VERSION,
    meta: { isNudge: true },
  };
}
