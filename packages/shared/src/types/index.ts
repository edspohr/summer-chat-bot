import type { TagDefinition } from "../schemas/tag.schema.js";
import type { Scenario } from "../schemas/scenario.schema.js";
import type { ConversationTurn } from "../schemas/safety.schema.js";

export type KnowledgeCollection =
  | "base_tag"
  | "scenario_tag"
  | "theoretical_framework";

export interface KnowledgeChunk {
  id: string;
  collection: KnowledgeCollection;
  tagId?: string;
  scenarioId?: string;
  content: string;
  metadata: Record<string, string>;
  contentHash: string;
}

export interface EmotionalStateVariables {
  emotionalIntensity: number;
  openness: number;
  trustInHelp: number;
}

// Latency breakdown stored per turn in Firestore
export interface TurnLatency {
  personaje: number;
  evaluador: number;
  total: number;
}

// Timer state returned to the client on each coach turn response.
// The session has no hard cutoff — the timer counts up from `sesionIniciadaEn`
// and is used for UI display and analytics only. The concept of "session
// complete" is defined below (SESSION_COMPLETE_AT_SECONDS).
export interface TimerState {
  sesionIniciadaEn: string | null; // ISO-8601 UTC or null if not started
  elapsedSeconds: number;
}

// A session is considered "complete" for reporting purposes once it has run
// at least this long. Under this threshold, the closing screen offers a
// suave confirmation before showing the report (or nudges the user to try
// again). Used by rollupBuilder, the pilot data export, and the web UI.
export const SESSION_COMPLETE_AT_SECONDS = 300 as const;

export interface BuiltPrompt {
  systemPrompt: string;
  userContent: string;
  promptVersion: string;
  estimatedTokens: number;
}

export interface MentorPromptInput {
  conversationHistory: ConversationTurn[];
  ragChunks: KnowledgeChunk[];
  userMessage: string;
  promptVersion: string;
}

export interface CoachCallAInput {
  scenario: Scenario;
  emotionalState: EmotionalStateVariables;
  conversationHistory: ConversationTurn[];
  traineeMessage: string;
  promptVersion: string;
}

export interface CoachCallBInput {
  pendingTags: TagDefinition[];
  scenarioContextSummary: string;
  conversationHistory: ConversationTurn[];
  traineeTurn: string;
  promptVersion: string;
}

export interface TagProgressItem {
  tagId: string;
  completed: boolean;
}
