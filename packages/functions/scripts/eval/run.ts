// CLI entry for the Fase 2 evaluation runner.
//
// Usage:
//   pnpm --filter @salvador/functions exec tsx scripts/eval/run.ts [flags]
//
// Flags:
//   --dry-run           default. Uses each fixture's dryRunMartina. No Vertex.
//   --live              opposite of --dry-run. Real Call A + Call B against Vertex.
//   --repeats N         default 1. Call A is temperature 0.85; baseline should use ≥3.
//   --modelA <id>       override Call A model (default: GEMINI_MODEL from vertex.ts).
//   --modelB <id>       override Call B model (default: CALLB_MODEL).
//   --judge             enable the informative LLM judge (--judge alone: gemini-2.5-flash).
//   --judge-model <id>  override judge model.
//   --fixture <path>    single fixture path (default: all in scripts/eval/fixtures).
//   --out <dir>         override output dir (default: docs/eval/baseline for --live,
//                       docs/eval/dryrun otherwise).
//   --help
//
// The runner NEVER writes to Firestore. It imports Call A / Call B / matrixApply
// directly (in --live) — never goes through the callable. It does not import
// `config/firebase.ts`. Debt-0021 safe.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FixtureSchema, type Fixture } from "./schema.js";
import type { RunnerDeps, RunnerOptions, FixtureResult, FixtureRun } from "./runner.js";
import { runFixture } from "./runner.js";
import type { CallARaw } from "./checks.js";
import { renderReport } from "./report.js";
import type { EvaluatorRawOutput, Scenario, TagDefinition } from "@salvador/shared";
import { ScenarioSchema } from "@salvador/shared";
import { MARTINA_SCENARIO, MARTINA_TAG_DEFINITIONS } from "../seed-scenario-03-martina.js";
import { JUDGE_MODEL_DEFAULT, buildJudgePrompt, parseJudgeVerdict } from "./judge.js";
import type { JudgeVerdict } from "./judge.js";

// ── Args ──────────────────────────────────────────────────────────────────

interface ParsedArgs extends RunnerOptions {
  fixture: string | null;
  out: string | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  const has = (flag: string): boolean => argv.includes(flag);
  const val = (flag: string, def: string): string => {
    const i = argv.indexOf(flag);
    if (i === -1) return def;
    return argv[i + 1] ?? def;
  };
  const num = (flag: string, def: number): number => {
    const raw = val(flag, "");
    const n = raw.length === 0 ? def : Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : def;
  };

  if (has("--help") || has("-h")) {
    printHelpAndExit();
  }

  const live = has("--live");
  const dry = has("--dry-run");
  if (live && dry) {
    console.error("Cannot pass --live and --dry-run together.");
    process.exit(1);
  }

  return {
    live,
    repeats: num("--repeats", 1),
    modelA: val("--modelA", "gemini-2.5-flash"),
    modelB: val("--modelB", "gemini-2.5-flash-lite"),
    judge: has("--judge"),
    judgeModel: val("--judge-model", JUDGE_MODEL_DEFAULT),
    fixture: val("--fixture", "") || null,
    out: val("--out", "") || null,
  };
}

function printHelpAndExit(): never {
  console.log(`\nFase 2 eval runner — see file header for usage.\n`);
  process.exit(0);
}

// ── Fixture loading ──────────────────────────────────────────────────────

async function loadFixtures(fixturesDir: string, single: string | null): Promise<Fixture[]> {
  if (single !== null && single !== "") {
    const raw = await fs.readFile(single, "utf-8");
    return [FixtureSchema.parse(JSON.parse(raw))];
  }
  const files = (await fs.readdir(fixturesDir))
    .filter((f) => f.endsWith(".json"))
    .sort();
  const out: Fixture[] = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(fixturesDir, f), "utf-8");
    out.push(FixtureSchema.parse(JSON.parse(raw)));
  }
  return out;
}

// ── Deps — dry-run ────────────────────────────────────────────────────────

function makeDryDeps(fixture: Fixture, opts: RunnerOptions): RunnerDeps {
  let turnIndex = 0;
  return {
    async callA(input): Promise<CallARaw> {
      const t = fixture.turns[turnIndex]!;
      turnIndex++;
      return {
        content: t.dryRunMartina,
        frameBreakSuspected: t.expected.requiresFrameBreakTag,
        finishReason: "STOP",
        latencyMs: 0,
      };
    },
    async callB(): Promise<EvaluatorRawOutput> {
      // Runner replaces this with a synthesized delta from fixture expectation
      // (see runner.ts::synthesizeDryDelta) — the empty object here is just a
      // shape-conforming placeholder.
      return { evaluated_tags: [] };
    },
    ...(opts.judge
      ? {
          async judge(trainee: string, martina: string): Promise<JudgeVerdict | null> {
            // Dry-run judge fabricates a plausible verdict so the report layout
            // is exercised end-to-end. The "razon" makes clear it's synthetic.
            return {
              personaje: 4,
              revela_criterios: /oasis|criterio|evaluaci[óo]n|tag_/i.test(martina),
              adolescente_verosimil: martina.length > 30 && martina.length < 400,
              razon: "[dry-run] no se llamó a Vertex; verdict sintético",
            };
          },
        }
      : {}),
  };
}

// ── Deps — live ───────────────────────────────────────────────────────────

async function makeLiveDeps(opts: RunnerOptions): Promise<RunnerDeps> {
  // Late imports so --dry-run does not pull @google-cloud/vertexai (~1s of
  // native binding load) into the hot path.
  const { runCallA } = await import("../../src/coach/callA.js");
  const { runCallB } = await import("../../src/coach/callB.js");
  const { VertexAI } = await import("@google-cloud/vertexai");
  const vertex = await import("../../src/config/vertex.js");

  const deps: RunnerDeps = {
    async callA(input): Promise<CallARaw> {
      const r = await runCallA(input, "escenario");
      return {
        content: r.content,
        frameBreakSuspected: r.frameBreakSuspected,
        // callA.ts does not expose finishReason today (debt-0020). Report skip.
        finishReason: null,
        latencyMs: r.latencyMs,
      };
    },
    async callB(input): Promise<EvaluatorRawOutput> {
      return runCallB(input, true);
    },
  };

  if (opts.judge) {
    const judgeClient = new VertexAI({
      project: vertex.VERTEX_PROJECT,
      location: vertex.VERTEX_REGION,
    });
    const judgeModel = judgeClient.getGenerativeModel({
      model: opts.judgeModel,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
      },
    });
    deps.judge = async (trainee: string, martina: string): Promise<JudgeVerdict | null> => {
      const prompt = buildJudgePrompt(trainee, martina);
      try {
        const result = await judgeModel.generateContent(prompt);
        const parts = result.response.candidates?.[0]?.content?.parts ?? [];
        let raw = "";
        for (const p of parts) if (typeof p.text === "string") raw += p.text;
        return parseJudgeVerdict(raw);
      } catch (err) {
        console.warn("[JUDGE] Vertex call failed:", err);
        return null;
      }
    };
  }
  return deps;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixturesDir = path.join(here, "fixtures");
  const fixtures = await loadFixtures(fixturesDir, opts.fixture);

  const outRoot = opts.out ?? path.join(here, "..", "..", "..", "..", "docs", "eval");
  const outDir = opts.out ?? path.join(outRoot, opts.live ? "baseline" : "dryrun");
  await fs.mkdir(outDir, { recursive: true });

  if (opts.live) {
    console.warn(
      "\n[LIVE] Running against Vertex. Cost is marginal but this consumes DSQ.\n" +
        "       Do NOT run this from a scheduler or during a workshop.\n",
    );
  }

  const scenario: Scenario = ScenarioSchema.parse(MARTINA_SCENARIO);
  const tagDefinitions: TagDefinition[] = MARTINA_TAG_DEFINITIONS as unknown as TagDefinition[];

  const startedAtIso = new Date().toISOString();
  const results: FixtureResult[] = [];
  for (const f of fixtures) {
    const runs: FixtureRun[] = [];
    for (let r = 0; r < opts.repeats; r++) {
      const deps = opts.live ? await makeLiveDeps(opts) : makeDryDeps(f, opts);
      const run = await runFixture(f, scenario, tagDefinitions, r, opts, deps);
      runs.push(run);
      console.log(`[${f.id}] run ${r + 1}/${opts.repeats}: ${run.verdict}`);
    }
    results.push({ fixture: f, runs });
  }

  const md = renderReport(results, opts, startedAtIso);
  const stamp = startedAtIso.replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `${stamp}.md`);
  await fs.writeFile(outFile, md);
  console.log(`\nWrote ${outFile}\n`);

  const totalRuns = results.reduce((s, r) => s + r.runs.length, 0);
  const failRuns = results.reduce((s, r) => s + r.runs.filter((x) => x.verdict === "FAIL").length, 0);
  if (failRuns > 0) {
    console.log(`${failRuns}/${totalRuns} runs FAILED`);
    process.exit(2);
  }
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
