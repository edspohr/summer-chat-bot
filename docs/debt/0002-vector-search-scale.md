---
id: "0002"
title: Firestore vector search untested at scale (>500 chunks)
severity: medium
status: open
---

## What was done

The RAG retriever uses Firestore native vector search (`findNearest`) to retrieve
top-K knowledge chunks. This is the MVP strategy — no external vector database.

## Why

Firestore native vector search is the path of least operational complexity for MVP.
No additional infrastructure (Pinecone, Weaviate, pgvector) required.

## What should be done

Load-test the vector search with realistic knowledge base sizes (500+ chunks, 768d
embeddings) and measure:
- p50/p95/p99 latency per retrieval call
- Firestore read costs per query
- Behavior under concurrent sessions

If latency exceeds 500ms p95 or costs become prohibitive, evaluate migration to
Cloud SQL (pgvector extension) or a dedicated vector store.

## Estimated effort

2–3 days (load test setup + analysis + decision)

## Context

Firestore vector search was in public preview as of early 2025. Production behavior at
scale may differ from emulator behavior. The `prefetchScenarioTags` function mitigates
one call per turn in Coach mode, but Mentor mode still calls `retrieveByQuery` per turn.
