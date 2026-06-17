---
id: "0001"
title: Embedding sync — one-time seed doesn't detect modified chunks
severity: medium
status: open
---

## What was done

The `scripts/seed-knowledge-base.ts` script performs a one-time indexing of all knowledge
chunks into Firestore with their embeddings. It does not detect whether a chunk has been
modified since it was last indexed (no diff/update logic).

## Why

Phase 0 scaffold — the seed script is a stub. Incremental sync requires comparing
`contentHash` (SHA-256 of chunk content) against stored hashes, which adds complexity
not needed at this stage.

## What should be done

Before each seed run, the script should:
1. Compute SHA-256 of each chunk's content
2. Query Firestore for existing chunks with the same source key
3. Skip unchanged chunks (hash matches), update embeddings for modified chunks,
   delete orphaned chunks no longer in the source

## Estimated effort

1 day

## Context

The `knowledge_base` collection stores a `contentHash` field for this purpose.
The field is defined in the schema but not used in the seed script yet.
Risk: stale embeddings if knowledge base documents are updated without re-running the
full seed from scratch.
