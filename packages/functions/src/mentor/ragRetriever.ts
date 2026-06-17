import type { KnowledgeChunk, KnowledgeCollection } from "@salvador/shared";
import { createKnowledgeBase } from "../knowledge/knowledgeBase.js";

export async function retrieveTopK(params: {
  query: string;
  collections: KnowledgeCollection[];
  topK: number;
}): Promise<KnowledgeChunk[]> {
  const kb = createKnowledgeBase();
  return kb.retrieveByQuery(params);
}
