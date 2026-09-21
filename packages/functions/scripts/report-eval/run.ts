// Fixture-driven runner for the coach_feedback_v1 generator.
//
// Usage (from repo root):
//   pnpm --filter @salvador/functions exec tsx scripts/report-eval/run.ts [flags]
//
// Flags:
//   --dry-run           (default) — runs sanitizeConversation + assemblePrompt + postProcessReport
//                       against a synthetic mock model response so the pipeline exercises without Vertex.
//   --live              real Vertex call via reportGeneratorModel.callFeedbackModel.
//                       Requires ADC + GCLOUD_PROJECT=summer-chatbot-dev.
//   --fixture <id>      run just this fixture (matches by fixture.id).
//   --thinking-budget N override the feedback thinkingBudget (compare 0 vs 1024).
//   --model <id>        override feedbackModel (default gemini-2.5-flash).
//   --out <dir>         markdown output dir (default docs/eval/report/{live|dryrun}).
//
// The runner does NOT touch Firestore. It builds an in-memory session from
// the fixture, invokes only the pure core + the Vertex-facing model helper.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  FormativeReport,
  MessageSlice,
  Scenario,
  TagDefinition,
  TurnoSlice,
  SessionSlice,
} from "@salvador/shared";
import {
  FormativeReportSchema,
  ScenarioSchema,
} from "@salvador/shared";
import { MARTINA_SCENARIO, MARTINA_TAG_DEFINITIONS } from "../seed-scenario-03-martina.js";
import {
  assemblePrompt,
  computeSessionFacts,
  extractJsonObject,
  formatConversationForPrompt,
  formatMatrixTrajectory,
  formatScenarioSummary,
  formatScenarioTags,
  formatSessionFacts,
  formatTurnEvaluations,
  postProcessReport,
  sanitizeConversation,
} from "../../src/session/reportGeneratorCore.js";
import { coach_feedback_v1 } from "../../src/prompts/content.js";

const PROMPT_VERSION = "coach_feedback_v1";

interface Fixture {
  id: string;
  title: string;
  description: string;
  wasResumedAfterCrisis: boolean;
  session: {
    state: string;
    endedReason: string | null;
    sesionIniciadaEnIso: string | null;
    endedAtIso: string | null;
    resumedAtIso?: string | null;
    scenarioId: string;
  };
  messages: MessageSlice[];
  turnos: TurnoSlice[];
  assertions: {
    expectedStatus: "ready" | "minimal" | "failed";
    minKeyMoments: number;
    maxKeyMoments: number;
    forbiddenSubstrings: string[];
    quoteMustAppearInUserMessages: boolean;
    martinaCueMustAppearInAssistantMessages: boolean;
    wasResumedAfterCrisis: boolean;
    quoteMustNotBeInExcludedTurns?: boolean;
  };
}

interface Opts {
  live: boolean;
  fixture: string | null;
  thinkingBudget: number;
  model: string;
  out: string | null;
}

function parseArgs(argv: string[]): Opts {
  const has = (f: string): boolean => argv.includes(f);
  const val = (f: string, def: string): string => {
    const i = argv.indexOf(f);
    return i === -1 ? def : argv[i + 1] ?? def;
  };
  return {
    live: has("--live"),
    fixture: (val("--fixture", "") || null),
    thinkingBudget: Number.parseInt(val("--thinking-budget", "1024"), 10),
    model: val("--model", "gemini-2.5-flash"),
    out: (val("--out", "") || null),
  };
}

// ── Dry-run: hand-authored mock response so the pipeline runs without Vertex.
function mockReportForFixture(fixture: Fixture): string {
  const userMsgs = fixture.messages.filter((m) => m.role === "user" && (m.safetyLayerTriggered ?? null) === null);
  const assistantMsgs = fixture.messages.filter((m) => m.role === "assistant" && m.meta?.isNudge !== true);
  const q1 = userMsgs[0]?.content.slice(0, 40) ?? "cita placeholder";
  const q2 = userMsgs[Math.min(1, userMsgs.length - 1)]?.content.slice(0, 40) ?? "otra cita placeholder";
  const cue1 = assistantMsgs[0]?.content.slice(0, 30);
  return JSON.stringify({
    synthesis: "Una conversación en la que abriste un espacio y Martina se atrevió a decir algo más de sí misma. Fue un intercambio breve y sostenido.",
    keyMoments: [
      {
        quote: q1,
        martinaCue: cue1,
        oasisPhase: "OBSERVA",
        whatHappenedWithMartina: "Martina soltó una respuesta corta pero abierta, con hesitación pero sin cerrarse.",
      },
      {
        quote: q2,
        oasisPhase: "ACOGE",
        whatHappenedWithMartina: "Se dio un espacio para que ella nombrara algo de lo que le pasa, sin apurar el ritmo.",
        suggestedAlternative: "Puedes reflejar lo que dijo ('me quedo pensando en lo que me dijiste') antes de proponer un siguiente paso.",
      },
    ],
    strengthToKeep: "Sostuviste una escucha calma, sin llenar los silencios ni saltar a soluciones.",
    focusForNextAttempt: "Explora un poco más los vínculos que ella misma menciona antes de proponer la red formal.",
    reflectionPrompts: [
      "¿Qué notaste en ti mientras esperabas su respuesta?",
      "¿Qué recurso propio te gustaría tener a mano para la próxima conversación?",
    ],
  });
}

async function loadFixtures(dir: string, single: string | null): Promise<Fixture[]> {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const out: Fixture[] = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(dir, f), "utf-8");
    const fx = JSON.parse(raw) as Fixture;
    if (single === null || fx.id === single || f.includes(single)) out.push(fx);
  }
  return out;
}

function buildSessionSlice(fixture: Fixture): SessionSlice {
  return {
    userId: "fixture",
    state: fixture.session.state,
    endedReason: fixture.session.endedReason,
    sesionIniciadaEnIso: fixture.session.sesionIniciadaEnIso,
    endedAtIso: fixture.session.endedAtIso,
    resumedAtIso: fixture.session.resumedAtIso ?? null,
    estadoMatriz: null,
    currentAttempts: 0,
    existingStatus: null,
    existingGeneratedAtIso: null,
  };
}

async function generateFromFixture(fixture: Fixture, opts: Opts): Promise<FormativeReport> {
  const scenario: Scenario = ScenarioSchema.parse(MARTINA_SCENARIO);
  const tags: TagDefinition[] = MARTINA_TAG_DEFINITIONS as unknown as TagDefinition[];
  const session = buildSessionSlice(fixture);
  const sanitized = sanitizeConversation(fixture.messages);
  const facts = computeSessionFacts(session, fixture.messages);
  const prompt = assemblePrompt(coach_feedback_v1, {
    scenarioSummary: formatScenarioSummary(scenario),
    scenarioTags: formatScenarioTags(tags),
    sessionFacts: formatSessionFacts(facts),
    turnEvaluations: formatTurnEvaluations(fixture.turnos),
    matrixTrajectory: formatMatrixTrajectory(fixture.turnos),
    conversation: formatConversationForPrompt(sanitized.messages),
  });

  let rawJson: string;
  let finishReason: string | null = "STOP";
  let modelUsed: string = "dry-run-mock";
  if (opts.live) {
    const { callFeedbackModel } = await import("../../src/session/reportGeneratorModel.js");
    const r = await callFeedbackModel({
      prompt,
      model: opts.model,
      maxOutputTokens: 4096,
      thinkingBudget: opts.thinkingBudget,
      timeoutMs: 30_000,
    });
    rawJson = r.rawJson;
    finishReason = r.finishReason;
    modelUsed = r.modelUsed;
    console.log(`[live] ${fixture.id} finishReason=${finishReason} latencyMs=${r.latencyMs} tokens=${r.candidateTokens}/${r.thoughtsTokens}`);
  } else {
    rawJson = mockReportForFixture(fixture);
  }

  const parsed = JSON.parse(extractJsonObject(rawJson));
  const post = postProcessReport(parsed, fixture.messages);
  if (!post.ok) {
    const report: FormativeReport = FormativeReportSchema.parse({
      status: "minimal",
      promptVersion: PROMPT_VERSION,
      generatedAtIso: new Date().toISOString(),
      skipReason: post.reason === "moments_unverifiable" ? "moments_unverifiable" : "generation_failed",
      wasResumedAfterCrisis: fixture.wasResumedAfterCrisis,
    });
    return report;
  }
  return FormativeReportSchema.parse({
    status: "ready",
    promptVersion: PROMPT_VERSION,
    generatedAtIso: new Date().toISOString(),
    modelUsed,
    content: post.content,
    wasResumedAfterCrisis: fixture.wasResumedAfterCrisis,
  });
}

interface AssertionResult {
  name: string;
  ok: boolean;
  detail?: string;
}

function assertReport(fixture: Fixture, report: FormativeReport): AssertionResult[] {
  const out: AssertionResult[] = [];
  const a = fixture.assertions;

  out.push({
    name: "status",
    ok: report.status === a.expectedStatus,
    detail: report.status !== a.expectedStatus ? `expected ${a.expectedStatus}, got ${report.status}` : undefined,
  });
  out.push({
    name: "wasResumedAfterCrisis",
    ok: report.wasResumedAfterCrisis === a.wasResumedAfterCrisis,
    detail: report.wasResumedAfterCrisis !== a.wasResumedAfterCrisis
      ? `expected ${a.wasResumedAfterCrisis}, got ${report.wasResumedAfterCrisis}` : undefined,
  });

  if (report.status !== "ready" || report.content === undefined) {
    out.push({ name: "content_present", ok: false, detail: "no content to assert further" });
    return out;
  }

  const moments = report.content.keyMoments;
  out.push({
    name: "moment_count",
    ok: moments.length >= a.minKeyMoments && moments.length <= a.maxKeyMoments,
    detail: `got ${moments.length}, expected [${a.minKeyMoments}, ${a.maxKeyMoments}]`,
  });

  // Every quote verbatim in the SANITIZED user messages (never in excluded turns).
  const sanitized = sanitizeConversation(fixture.messages);
  const userTexts = sanitized.messages.filter((m) => m.role === "user").map((m) => m.content.toLowerCase());
  const assistantTexts = sanitized.messages.filter((m) => m.role === "assistant").map((m) => m.content.toLowerCase());
  const excludedUserTexts = fixture.messages
    .filter((_, i) => sanitized.excludedIndices.includes(i))
    .map((m) => m.content.toLowerCase());

  for (let i = 0; i < moments.length; i++) {
    const q = moments[i]!.quote.toLowerCase();
    const inUser = userTexts.some((t) => t.includes(q));
    out.push({
      name: `quote_in_user_${i + 1}`,
      ok: inUser || !a.quoteMustAppearInUserMessages,
      detail: !inUser ? `quote "${moments[i]!.quote.slice(0, 60)}…" not found in sanitized user messages` : undefined,
    });
    if (a.quoteMustNotBeInExcludedTurns === true) {
      const inExcluded = excludedUserTexts.some((t) => t.includes(q));
      out.push({
        name: `quote_not_in_excluded_${i + 1}`,
        ok: !inExcluded,
        detail: inExcluded ? `quote appears in an excluded (crisis) turn` : undefined,
      });
    }
    const cue = moments[i]!.martinaCue;
    if (cue !== undefined) {
      const inAsst = assistantTexts.some((t) => t.includes(cue.toLowerCase()));
      out.push({
        name: `cue_in_assistant_${i + 1}`,
        ok: inAsst || !a.martinaCueMustAppearInAssistantMessages,
        detail: !inAsst ? `martinaCue "${cue.slice(0, 60)}…" not in sanitized assistant messages` : undefined,
      });
    }
  }

  // Forbidden terms — word-boundary match so "nota" does not fire on
  // "notaste". Non-alphanumeric literals (%, punctuation) fall back to a
  // plain substring check.
  const contentBlob = JSON.stringify(report.content);
  for (const f of a.forbiddenSubstrings) {
    const isWord = /^[a-záéíóúñü]+$/i.test(f);
    let present: boolean;
    if (isWord) {
      const re = new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "iu");
      present = re.test(contentBlob);
    } else {
      present = contentBlob.toLowerCase().includes(f.toLowerCase());
    }
    out.push({
      name: `forbidden_${f}`,
      ok: !present,
      detail: present ? `forbidden term "${f}" appeared as a whole word or literal` : undefined,
    });
  }

  return out;
}

function renderReportMarkdown(fixture: Fixture, report: FormativeReport, assertions: AssertionResult[]): string {
  const lines: string[] = [];
  lines.push(`# Fixture — ${fixture.id}`);
  lines.push("");
  lines.push(`_${fixture.description}_`);
  lines.push("");
  lines.push(`## Report envelope`);
  lines.push("");
  lines.push(`- status: **${report.status}**`);
  lines.push(`- promptVersion: ${report.promptVersion}`);
  lines.push(`- modelUsed: ${report.modelUsed ?? "-"}`);
  lines.push(`- wasResumedAfterCrisis: ${report.wasResumedAfterCrisis}`);
  if (report.skipReason !== undefined) lines.push(`- skipReason: ${report.skipReason}`);
  if (report.failureDetail !== undefined) lines.push(`- failureDetail: ${report.failureDetail}`);
  lines.push("");
  if (report.status === "ready" && report.content !== undefined) {
    lines.push("## Content");
    lines.push("");
    lines.push(`**synthesis**: ${report.content.synthesis}`);
    lines.push("");
    lines.push(`**strengthToKeep**: ${report.content.strengthToKeep}`);
    lines.push("");
    lines.push(`**focusForNextAttempt**: ${report.content.focusForNextAttempt}`);
    lines.push("");
    lines.push(`**reflectionPrompts**:`);
    for (const p of report.content.reflectionPrompts) lines.push(`- ${p}`);
    lines.push("");
    lines.push(`**keyMoments** (${report.content.keyMoments.length}):`);
    for (const m of report.content.keyMoments) {
      lines.push("");
      lines.push(`> **quote**: "${m.quote}"`);
      if (m.martinaCue !== undefined) lines.push(`> **martinaCue**: "${m.martinaCue}"`);
      if (m.oasisPhase !== undefined) lines.push(`> **oasisPhase**: ${m.oasisPhase}`);
      lines.push(`> **whatHappenedWithMartina**: ${m.whatHappenedWithMartina}`);
      if (m.suggestedAlternative !== undefined) lines.push(`> **suggestedAlternative** _(ejemplo sugerido, TODO_CLINICAL_VALIDATION)_: ${m.suggestedAlternative}`);
    }
    lines.push("");
  }
  lines.push("## Assertions");
  lines.push("");
  for (const a of assertions) {
    lines.push(`- ${a.ok ? "PASS" : "**FAIL**"} · ${a.name}${a.detail !== undefined ? ` — ${a.detail}` : ""}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixturesDir = path.join(here, "fixtures");
  const fixtures = await loadFixtures(fixturesDir, opts.fixture);
  const outRoot = opts.out ?? path.join(here, "..", "..", "..", "..", "docs", "eval", "report", opts.live ? "live" : "dryrun");
  await fs.mkdir(outRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (opts.live) {
    console.warn("[LIVE] Running against Vertex. Consumes DSQ. Never run from a scheduler.");
  }
  let anyFail = false;
  for (const fx of fixtures) {
    const report = await generateFromFixture(fx, opts);
    const assertions = assertReport(fx, report);
    const failures = assertions.filter((a) => !a.ok);
    const md = renderReportMarkdown(fx, report, assertions);
    const out = path.join(outRoot, `${stamp}__${fx.id}${opts.live ? "" : ".dry"}${opts.thinkingBudget !== 1024 ? `.tb${opts.thinkingBudget}` : ""}.md`);
    await fs.writeFile(out, md);
    console.log(`[${fx.id}] ${failures.length === 0 ? "PASS" : `FAIL (${failures.length})`} → ${out}`);
    if (failures.length > 0) anyFail = true;
  }
  process.exit(anyFail ? 2 : 0);
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
