---
id: 0014
title: pnpm workspace:* incompatible with Cloud Build npm — resolved via file:../shared + .firebaseignore
severity: medium
status: implemented
---

## What was done

Two separate issues required two fixes:

### Fix 1 — workspace:* protocol (deploy error)

`packages/functions/package.json` referenced `@salvador/shared` as `"workspace:*"`.
Firebase Cloud Build uses npm internally to install function dependencies after upload.
npm does not understand the pnpm `workspace:*` protocol:

```
npm error Unsupported URL Type "workspace:": workspace:*
```

Fixed by changing the dependency specifier to `"file:../shared"`.

### Fix 2 — shared package not in Firebase upload (Cloud Run healthcheck failure)

Firebase CLI v15 does **not** follow `file:` references that point outside the source
directory (`"source": "packages/functions"`). With `"@salvador/shared": "file:../shared"`,
the `packages/shared` directory was never included in the Firebase upload archive
(confirmed: archive was 79.91 KB, containing only `packages/functions`).

Locally, `@salvador/shared` resolves via a **pnpm symlink** to `packages/shared`,
so local module loads always succeed. In Cloud Build, npm does a fresh install from
the uploaded archive — `@salvador/shared` was missing entirely, the process crashed at
startup, and Cloud Run reported a healthcheck failure.

Fixed by:
1. Changing the dependency to `"file:./vendor-shared"` — a path **inside** `packages/functions`
2. Adding a predeploy step that copies `packages/shared/package.json` + `packages/shared/dist/`
   into `packages/functions/vendor-shared/` before Firebase packages the upload
3. Adding a root-level `pnpm.overrides["@salvador/shared"] = "workspace:*"` so pnpm
   ignores the `file:./vendor-shared` reference locally and keeps resolving through the
   workspace symlink — local dev is unchanged
4. Adding `packages/functions/vendor-shared/` to `.gitignore` (generated artifact)
5. Creating `.firebaseignore` to ensure `dist/` is not excluded when Firebase CLI reads
   ignore patterns (since `dist/` appears in `.gitignore`)

## Why

The pnpm symlink masks the packaging issue during local development — the module always
resolves correctly locally, making this hard to catch without inspecting the Cloud Build
artifact or reading Cloud Run startup logs.

## What should be done

Investigate whether switching the functions package to an esbuild-based bundler
(e.g. `esbuild` or `tsup`) would eliminate this class of issue entirely: bundle all
dependencies — including `@salvador/shared` — into a single `dist/index.js` before
upload. Cloud Build would need no dependency resolution at all.

This is the standard approach for Firebase Functions in pnpm monorepos and would also
improve cold-start latency.

## Estimated effort

2–4 hours — esbuild config, source map verification, smoke-test of all three functions.

## Context

Discovered during Latency Lab deploy sprint (2026-05-12). Both fixes together are
correct and stable. The esbuild path is a future improvement, not a blocker.
Do not revert either fix without re-reading this entry.
