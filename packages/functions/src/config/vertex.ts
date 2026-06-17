// us-central1 is hard-coded per ADR-001. gemini-2.5-flash returns HTTP 400
// FAILED_PRECONDITION in southamerica-west1 and any other region.
// Changing this requires a new ADR — not a config change.
export const VERTEX_REGION = "us-central1" as const;

export const VERTEX_PROJECT = process.env["GCLOUD_PROJECT"] ?? "";

export const GEMINI_MODEL = "gemini-2.5-flash" as const;
export const EMBEDDINGS_MODEL = "gemini-embedding-001" as const;
export const EMBEDDINGS_DIMENSION = 768 as const;
