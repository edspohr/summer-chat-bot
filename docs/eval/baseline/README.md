# Baseline runs

This directory holds `--live` runs of the Fase 2 eval runner (see
`scripts/eval/run.ts`) with the current production models. Every file
under here is DRAFT until the clinical team validates the criteria
(see `../GUIDELINES.md`).

Each run is one markdown file, timestamped:

```
docs/eval/baseline/YYYY-MM-DDThh-mm-ss-mmmZ.md
```

## How to produce a baseline

The runner needs Application Default Credentials for `summer-chatbot-dev`.
If your ADC are expired you will see a `gaxios` 400 error on the OAuth
token exchange path — that means "re-auth" (see debt-0025). Renew with:

```bash
gcloud auth application-default login --account=edmundo@spohr.cl
gcloud auth application-default set-quota-project summer-chatbot-dev
```

Then run:

```bash
GCLOUD_PROJECT=summer-chatbot-dev \
  pnpm --filter @salvador/functions exec tsx scripts/eval/run.ts \
    --live --repeats 3 --judge
```

- `--live` uses real Vertex calls (Call A: `gemini-2.5-flash`, Call B:
  `gemini-2.5-flash-lite`). Consumes DSQ but the cost of a full 10-fixture
  × 3-repeat run is marginal (~30 Call A + ~30 Call B).
- `--repeats 3` matters — Call A runs at temperature 0.85, so a single
  sample per fixture is not representative.
- `--judge` enables the informative LLM judge. Its output goes in a
  separate section titled "Juez LLM — no es validación clínica" and does
  NOT affect the deterministic PASS/FAIL verdict.

Do NOT run the baseline from a scheduler or during a workshop (see the
warning printed by the runner on start).

## First baseline — pending

The first baseline run has NOT been captured yet as of 2026-09-21. The
runner is verified end-to-end in dry-run
(`docs/eval/dryrun/2026-09-21T03-55-01-269Z.md`) — the 10 fixtures load,
Zod parses them, checks run, matrix delta applies, judge (in dry-run
synthetic mode) fills the report. Attempting `--live` on this workstation
fails at OAuth (ADC refresh required — debt-0025).

When the operator with valid ADC runs the command above, drop the
resulting markdown here and delete this "pending" note.
