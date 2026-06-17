---
id: "0005"
title: Java not in system PATH — Firestore emulator requires manual PATH export
severity: low
status: open
---

## What was done

Firebase emulators:start fails with "Process java -version has exited with code 1" on the
development machine because /usr/bin/java is a macOS stub (not a real JRE), even though
OpenJDK 25 is installed via Homebrew at /opt/homebrew/opt/openjdk/bin/java.

## Why

Homebrew OpenJDK is installed but not linked to /usr/bin. The macOS system java stub
returns exit code 1 without running, causing the Firebase CLI to think Java is absent.

## What should be done

Add to the team's setup guide (or a .envrc / shell profile):

  export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"

Or run firebase commands via:

  PATH="/opt/homebrew/opt/openjdk/bin:$PATH" firebase emulators:start

Long-term: add a project-level .envrc (using direnv) or a Makefile target that sets
the PATH before calling firebase, so every developer gets this automatically.

## Estimated effort

30 minutes (add .envrc + direnv setup docs)

## Context

Discovered during Phase 0 scaffolding on development machine (macOS, Apple Silicon).
Firebase Firestore emulator requires Java. Functions and Auth emulators are Node.js-only
and start fine without Java, but Firestore requires it for the gRPC server.
