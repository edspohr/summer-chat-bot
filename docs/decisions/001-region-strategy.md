---
id: ADR-001
title: Firestore in southamerica-west1, Vertex AI in us-central1
date: 2026-05-06
status: accepted
---

## Context

Salvador handles mental health training conversations — sensitive personal data under
Chile's Ley 19.628 (Protección de la Vida Privada).

gemini-2.5-flash is NOT available in southamerica-west1. Any call to Vertex AI in
that region returns HTTP 400 FAILED_PRECONDITION. This is not a configuration error.

Pattern validated in prior products built by the same technical team.

## Decision

- Firestore + Cloud Functions → southamerica-west1 (Chilean data residency)
- Vertex AI inference + embeddings → us-central1 (only region with model availability)

## Consequences (positive)

- Sensitive data stays in Chile. Strongest position for Ley 19.628 compliance.
- Uses the most capable available model without compromise.
- Follows a tested, validated pattern — no new infrastructure risk.

## Consequences (negative)

- Conversation content (trainee messages, character responses, evaluator inputs)
  crosses to us-central1 during the API call.
- Mitigation: Google does not train on customer data by default in enterprise API usage.
  Fundación Summer must confirm data processing agreement with their legal team before
  production deployment.

## Revisit when

- gemini-2.5-flash becomes available in southamerica-west1 or an equivalent LATAM region.
- Chilean regulatory requirements change to require AI inference within Chile.

## Implementation note

The us-central1 endpoint is hard-coded in packages/functions/src/config/vertex.ts.
This is intentional. Removing the hard-code requires a deliberate ADR review,
not a config change.

## Amendment 2026-07-10 — Cloud Scheduler exception

Cloud Scheduler is not offered in southamerica-west1. The Phase 3 (A2) inactivity
scheduler function `inactivityScan` therefore runs in southamerica-east1 (São Paulo,
Brazil), the closest Scheduler-valid region.

Data residency is preserved: Firestore stays in southamerica-west1; the scheduler
only reads/writes over the network, no user data is persisted in Brazil. All other
Cloud Functions (coachTurn, mentorChat, timerOverride, crisisBranch, labChat)
remain in southamerica-west1 as originally decided.

Revisit if Cloud Scheduler ships in southamerica-west1 — the region is a single
constant in `packages/functions/src/session/inactivityScheduler.ts`, no other code
depends on it.
