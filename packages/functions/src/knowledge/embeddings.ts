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

// Dynamic import: `import { GoogleAuth } from "google-auth-library"` at module
// top level blocks Firebase CLI's source-code discovery pass indefinitely (the
// package does IO on evaluation). Loading it inside getAuth() defers cost to
// first embedText() call. See docs/debt/0021.
type GoogleAuthInstance = InstanceType<
  typeof import("google-auth-library").GoogleAuth
>;
let authInstance: GoogleAuthInstance | null = null;
async function getAuth(): Promise<GoogleAuthInstance> {
  if (authInstance !== null) return authInstance;
  const { GoogleAuth } = await import("google-auth-library");
  authInstance = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  return authInstance;
}

interface EmbedContentResponse {
  embedding: { values: number[] };
}

export async function embedText(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_QUERY"
): Promise<number[]> {
  const auth = await getAuth();
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
