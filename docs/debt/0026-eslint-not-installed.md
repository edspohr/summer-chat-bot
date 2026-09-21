---
id: 0026
title: ESLint config exists but the tool is not installed in the monorepo
severity: medium
status: open
---

## What is broken

The repo has an `.eslintrc.cjs` and CLAUDE.md §4 documents `pnpm lint` as a
supported command, but no `eslint` package is installed in `pnpm-lock.yaml`
and no package has a `lint` script. `pnpm -r lint` is therefore a no-op.

This surfaced during the Fase 1 correctivo (bug in `LabChat.tsx` — early
return between hook calls, React error #300 in prod). A working
`react-hooks/rules-of-hooks` rule would have caught it at commit time. The
rule is now defined in `.eslintrc.cjs`, but nothing runs it.

## What should be done

1. Install ESLint 8 (last major that supports the legacy `.eslintrc.cjs`
   format) plus:
   - `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
     (already referenced in the config's `overrides`)
   - `eslint-plugin-react-hooks` (referenced by the new override for
     `packages/web/**/*.{ts,tsx}`)
2. Add a `"lint": "eslint 'src/**/*.{ts,tsx}'"` script to each package that
   should be linted (`web`, `functions`, `shared`).
3. Optionally move to ESLint 9 + flat config (`eslint.config.js`) — this is
   a bigger migration; ESLint 8 unblocks the immediate need.
4. Wire into CI so the rule catches regressions.

## Why not fix now

Installing four packages + verifying that every existing file passes the
rules is not scope for a Fase 1 correctivo. The concrete bug the missing
rule masked (LabChat hooks-order) was fixed by hand in the same commit that
added the config entry; the config sits idle until the tooling is in place.

## Related

- `.eslintrc.cjs` — has the `react-hooks/rules-of-hooks` rule defined for
  `packages/web/**/*.{ts,tsx}`.
- CLAUDE.md §4 — documents `pnpm lint` as a supported workflow.
