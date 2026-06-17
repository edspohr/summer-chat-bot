---
id: 0010
title: lab_sessions Firestore collection has no security rules
severity: high
status: implemented
---

## What was done

The `lab_sessions` Firestore collection (and its `messages` subcollection) were added
in `labChatHandler.ts` but no security rules were written for them.

The collection is used exclusively by the Latency Lab — a dev-only tool that should be
readable and writable only by admin users. Currently, whatever rules apply globally to
the project also apply to `lab_sessions`.

## Why

Security rules were out of scope for the Latency Lab implementation sprint. The lab
deploys to `summer-chatbot-dev` only, which reduces the blast radius. However,
`summer-chatbot-dev` may be accessible to testers beyond the core dev team.

## What should be done

Add Firestore security rules to `firestore.rules` restricting `lab_sessions`:

```javascript
match /lab_sessions/{sessionId} {
  allow read, write: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";

  match /messages/{messageId} {
    allow read, write: if request.auth != null
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
  }
}
```

This mirrors the admin check already implemented in the `LabChat.tsx` page component,
enforcing it at the data layer as well.

## Estimated effort

Completed 2026-05-12. Rules written and tested with Firestore emulator (11/11 tests pass).
Test script: `scripts/test-firestore-rules.ts`. Run with: `pnpm test:rules`.

## Context

The `LabChat.tsx` component already checks `users/{uid}.role === "admin"` before
rendering. The Firestore rules provide the defense-in-depth layer. Without rules,
any authenticated user who guesses the collection name can read lab session data,
which may contain sensitive crisis template responses and trainee message content
(even from dev testing sessions).

This is a **production blocker** if the web UI is ever accessible to participants
(it isn't currently — no nav link — but rules provide the safety net).
