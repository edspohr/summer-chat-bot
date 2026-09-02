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

// Timer state returned to the client on each coach turn response
export interface TimerState {
  sesionIniciadaEn: string | null; // ISO-8601 UTC or null if not started
  elapsedSeconds: number;
  remainingSeconds: number; // negative means expired
  cronometroAnulado: boolean;
}

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
