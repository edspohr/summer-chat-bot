# 0031 — iCloud offloads `node_modules` files; `tsc`, `git` and vitest hang silently

**Severity**: medium
**Status**: open
**Registered**: 2026-10-03 (warm-instances schedule session)

## Symptom

`pnpm typecheck` sat for 12+ minutes with ~0.7 s of CPU and no output.
`lsof` showed `tsc` blocked reading
`node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es2015.symbol.d.ts`.
`ls -lO` on that directory showed 97 of 125 files flagged `dataless`: the
repo lives under `~/Documents`, which is iCloud-synced with "Optimize Mac
Storage", and the placeholder download never completed. A `git log -S` in
the same session also stalled. The stray `packages/functions/vendor-shared 2`
directory is an iCloud conflict copy from the same cause.

## Why it matters

- The deploy predeploy runs `tsc` (shared + functions build). With offloaded
  files it hangs with no error, which looks like the discovery timeouts
  recorded in debt-0023.
- It may be the real cause, or a contributor, of debt-0021 (vitest hang) and
  debt-0025 (scripts hang with no output). On 2026-10-03, after reinstalling,
  the full functions suite (13 files, 180 tests, including
  `matrixEngine.test.ts` and `timerService.test.ts`) passed in 6 s.

## Workaround (applied 2026-10-03)

```bash
pnpm install --force --offline --frozen-lockfile
```

Rewrites `node_modules` from the local pnpm store (outside `~/Documents`).
iCloud can offload the files again at any time.

## Proper fix

Move the repo out of iCloud-synced folders (e.g. `~/dev/SummerBot`), or
exclude `node_modules` from sync. Then re-test debt-0021 and debt-0025 and
close them if they no longer reproduce.

Check for offloaded files:

```bash
ls -lO node_modules/.pnpm/typescript@*/node_modules/typescript/lib | grep -c dataless
```
