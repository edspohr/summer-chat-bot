---
id: "0006"
title: Knowledge base not seeded — Mentor RAG returns empty until Firestore is populated
severity: high
status: partially-resolved
---

## Status (2026-05-11)

The seed script is complete and tested. Pending: running it against a live environment.

## What was done

`packages/functions/scripts/seed-knowledge-base.ts` is fully implemented and idempotent:
- Writes Scenario 01 (Camila Rojas) to `scenarios/scenario_01_camila`
- Writes all 8 TagDefinition documents to `tag_definitions/`
- Embeds and writes 22 knowledge_base chunks:
  - 8 `base_tag` chunks (generic OASIS competency descriptions)
  - 8 `scenario_tag` chunks (Camila-specific RAG context per tag)
  - 6 `theoretical_framework` chunks (per-topic: OASIS overview, phases, resources, ideation, anti-patterns)

## What remains

1. Start the Firebase emulator and run:
   ```
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=salvador-dev \
   pnpm --filter @salvador/functions seed:no-embeddings
   ```
   (scenario + tags only — no Vertex AI needed)

2. For embeddings, run with real GCP credentials:
   ```
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=salvador-dev \
   pnpm --filter @salvador/functions seed
   ```

3. Deploy the Firestore vector index before querying:
   ```
   firebase deploy --only firestore:indexes --project salvador-dev
   ```

## Known gap

The seed content is derived from the `docs/01_escenario_camila.md` specification and the
architecture documentation. If Fundación Summer provides additional official OASIS documentation
(full methodology manual, training guides), those should be chunked and added to
`theoretical_framework` collection to improve RAG grounding.
