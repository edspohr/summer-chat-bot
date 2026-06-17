import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { KnowledgeChunk, KnowledgeCollection } from "@salvador/shared";
import { db } from "../config/firebase.js";
import { embedText } from "./embeddings.js";

const COLLECTION = "knowledge_base";

export interface KnowledgeBaseService {
  indexChunk(chunk: {
    collection: KnowledgeCollection;
    tagId?: string;
    scenarioId?: string;
    content: string;
    metadata: Record<string, string>;
  }): Promise<string>;

  retrieveByQuery(params: {
    query: string;
    collections: KnowledgeCollection[];
    topK: number;
  }): Promise<KnowledgeChunk[]>;

  retrieveByTagId(tagId: string): Promise<KnowledgeChunk | null>;

  prefetchScenarioTags(scenarioId: string): Promise<Map<string, KnowledgeChunk>>;
}

interface KnowledgeDoc {
  collection: KnowledgeCollection;
  tagId?: string;
  scenarioId?: string;
  content: string;
  metadata: Record<string, string>;
  contentHash: string;
}

function docToChunk(id: string, data: KnowledgeDoc): KnowledgeChunk {
  return {
    id,
    collection: data.collection,
    content: data.content,
    metadata: data.metadata,
    contentHash: data.contentHash,
    ...(data.tagId !== undefined && { tagId: data.tagId }),
    ...(data.scenarioId !== undefined && { scenarioId: data.scenarioId }),
  };
}

export function createKnowledgeBase(): KnowledgeBaseService {
  return {
    async indexChunk(chunk) {
      const contentHash = createHash("sha256").update(chunk.content).digest("hex");
      const embedding = await embedText(chunk.content, "RETRIEVAL_DOCUMENT");

      const docRef = db.collection(COLLECTION).doc();
      await docRef.set({
        collection: chunk.collection,
        tagId: chunk.tagId ?? null,
        scenarioId: chunk.scenarioId ?? null,
        content: chunk.content,
        metadata: chunk.metadata,
        contentHash,
        embedding: FieldValue.vector(embedding),
        createdAt: FieldValue.serverTimestamp(),
      });
      return docRef.id;
    },

    async retrieveByQuery({ query, collections, topK }) {
      const queryEmbedding = await embedText(query, "RETRIEVAL_QUERY");

      const baseQuery =
        collections.length > 0
          ? db.collection(COLLECTION).where("collection", "in", collections)
          : db.collection(COLLECTION);

      const vectorQuery = baseQuery.findNearest({
        vectorField: "embedding",
        queryVector: queryEmbedding,
        limit: topK,
        distanceMeasure: "DOT_PRODUCT",
      });

      const snap = await vectorQuery.get();
      return snap.docs.map((doc) => docToChunk(doc.id, doc.data() as KnowledgeDoc));
    },

    async retrieveByTagId(tagId) {
      const snap = await db
        .collection(COLLECTION)
        .where("tagId", "==", tagId)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      if (doc === undefined) return null;
      return docToChunk(doc.id, doc.data() as KnowledgeDoc);
    },

    async prefetchScenarioTags(scenarioId) {
      const snap = await db
        .collection(COLLECTION)
        .where("scenarioId", "==", scenarioId)
        .where("collection", "==", "scenario_tag")
        .get();
      const result = new Map<string, KnowledgeChunk>();
      for (const doc of snap.docs) {
        const chunk = docToChunk(doc.id, doc.data() as KnowledgeDoc);
        if (chunk.tagId !== undefined) {
          result.set(chunk.tagId, chunk);
        }
      }
      return result;
    },
  };
}
