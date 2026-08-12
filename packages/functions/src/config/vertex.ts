// us-central1 is hard-coded per ADR-001. gemini-2.5-flash returns HTTP 400
// FAILED_PRECONDITION in southamerica-west1 and any other region.
// Changing this requires a new ADR — not a config change.
export const VERTEX_REGION = "us-central1" as const;

export const VERTEX_PROJECT = process.env["GCLOUD_PROJECT"] ?? "";

export const GEMINI_MODEL = "gemini-2.5-flash" as const;

// Call B (evaluator) runs on flash-lite, breaking the "all coach flows use
// GEMINI_MODEL" invariant on purpose. Rationale: gemini-2.5-flash and
// gemini-2.5-flash-lite sit on separate Vertex Dynamic Shared Quota pools,
// so evaluator load can no longer starve Martina's (Call A) replies during
// workshop bursts. See docs/debt/0019-callb-model-split.md and the
// 2026-08-11 DSQ incident notes.
export const CALLB_MODEL = "gemini-2.5-flash-lite" as const;

export const EMBEDDINGS_MODEL = "gemini-embedding-001" as const;
export const EMBEDDINGS_DIMENSION = 768 as const;
