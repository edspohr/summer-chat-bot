import type {
  MentorPromptInput,
  CoachCallAInput,
  CoachCallBInput,
  BuiltPrompt,
} from "@salvador/shared";

// Phase 0 stub. Full implementation in Phase 3+.
// INVARIANT: never modify system prompt text — only substitute defined placeholders.
export async function buildMentorPrompt(
  _input: MentorPromptInput
): Promise<BuiltPrompt> {
  return {
    systemPrompt: "",
    userContent: "",
    promptVersion: "mentor_v1",
    estimatedTokens: 0,
  };
}

export async function buildCoachCallAPrompt(
  _input: CoachCallAInput
): Promise<BuiltPrompt> {
  return {
    systemPrompt: "",
    userContent: "",
    promptVersion: "coach_conversational_v1",
    estimatedTokens: 0,
  };
}

export async function buildCoachCallBPrompt(
  _input: CoachCallBInput
): Promise<BuiltPrompt> {
  return {
    systemPrompt: "",
    userContent: "",
    promptVersion: "coach_evaluator_v1",
    estimatedTokens: 0,
  };
}
