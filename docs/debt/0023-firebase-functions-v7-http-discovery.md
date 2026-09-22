---
id: 0023
title: firebase-functions@7 HTTP discovery hangs on this env — must use file-based discovery
severity: low
status: workaround-in-use
---

## What was done

After bumping `firebase-functions` from `^6.0.0` to `^7.4.0` (see debt-0013), every
`firebase deploy --only functions` fails at the manifest-discovery step:

```
i  functions: Loading and analyzing source code for codebase default to determine what to deploy
[…]
Failed to call quitquitquit. This often means the server failed to start fetch failed {}

Error: User code failed to load. Cannot determine backend specification. Timeout after 10000.
```

The CLI spawns `packages/functions/node_modules/.bin/firebase-functions`, which is
supposed to start an Express server on a CLI-provided port and expose the manifest at
`/__/functions.yaml`. On this machine (macOS 27, pnpm 10.33.1 workspace, Node 22.19.0)
the server never becomes reachable from the CLI within the 10s deadline. Running the
same binary manually with `FUNCTIONS_CONTROL_API=true PORT=8765 node …/firebase-functions.js .`
brings the server up in under 2s and returns a well-formed manifest — the code loads
fine, the interaction with the CLI is where it breaks.

## Workaround

Set `FIREBASE_FUNCTIONS_DISCOVERY_OUTPUT_PATH=true` before `firebase deploy`. This
switches the CLI from HTTP discovery to file-based discovery: it passes
`FUNCTIONS_MANIFEST_OUTPUT_PATH=<tmpfile>` to the binary, the binary writes the
manifest to disk and exits 0, and the CLI reads the file. No polling, no HTTP,
no 10s deadline.

```bash
FIREBASE_FUNCTIONS_DISCOVERY_OUTPUT_PATH=true \
  firebase deploy --only functions --project summer-chatbot-dev
```

The env var name and behavior are documented in `firebase-tools`
`src/deploy/functions/runtimes/node/index.ts` (`discoverBuild` method).

CLAUDE.md §4 uses this prefix in every canonical deploy command.

## Why low severity

- Deploy works reliably with the workaround.
- No user-facing impact (only affects local `firebase deploy`).
- Upstream may fix the HTTP discovery flow — this doc is a breadcrumb if the workaround
  ever needs to come off. Related upstream issues: firebase-tools#9502 (closed as stale
  without root cause) and firebase-tools#8085 (open, triage comment from maintainer:
  "there's already an opt-in fix — file-based discovery — keeping this open to make
  that the default").

## Not to be confused with

- debt-0021 (vitest hangs on files that import `src/config/firebase.ts`) — unrelated,
  same file but different subsystem.
- debt-0014 (pnpm workspace:* incompatible with Cloud Build) — resolved via vendor-shared
  predeploy; still needed and still working on Node 22.
