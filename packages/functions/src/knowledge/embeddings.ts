import { GoogleAuth } from "google-auth-library";
import {
  VERTEX_PROJECT,
  VERTEX_REGION,
  EMBEDDINGS_MODEL,
  EMBEDDINGS_DIMENSION,
} from "../config/vertex.js";

export type EmbeddingTaskType =
  | "RETRIEVAL_QUERY"
  | "RETRIEVAL_DOCUMENT"
  | "SEMANTIC_SIMILARITY";

// Shared auth client — reuses cached token across warm invocations.
const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

interface EmbedContentResponse {
  embedding: { values: number[] };
}

export async function embedText(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_QUERY"
): Promise<number[]> {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;
  if (token === null || token === undefined) {
    throw new Error("Failed to obtain Vertex AI access token");
  }

  const url =
    `https://${VERTEX_REGION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}` +
    `/locations/${VERTEX_REGION}/publishers/google/models/${EMBEDDINGS_MODEL}:embedContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDINGS_DIMENSION,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vertex AI embedContent ${res.status}: ${body}`);
  }

  const data = (await res.json()) as EmbedContentResponse;
  return data.embedding.values;
}
