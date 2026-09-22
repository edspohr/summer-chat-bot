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

// Default default (pun) — the runner defaults to feedbackThinkingBudget=0
// per the 2026-09-21 A/B; --thinking-budget overrides.
const DEFAULT_THINKING_BUDGET = 0;

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
    thinkingBudget: Number.parseInt(val("--thinking-budget", String(DEFAULT_THINKING_BUDGET)), 10),
    model: val("--model", "gemini-2.5-flash"),
    out: (val("--out", "") || null),
  };
}

// ── Dry-run: hand-authored mock response so the pipeline runs without Vertex.
// Kept in the new coaching shape (acierto / oportunidad + nextChallenge +
// mentorQuestion). The first moment is ALWAYS acierto per the balance rule.
function mockReportForFixture(fixture: Fixture): string {
  const userMsgs = fixture.messages.filter((m) => m.role === "user" && (m.safetyLayerTriggered ?? null) === null);
  const assistantMsgs = fixture.messages.filter((m) => m.role === "assistant" && m.meta?.isNudge !== true);
  const q1 = userMsgs[0]?.content.slice(0, 40) ?? "cita placeholder";
  const q2 = userMsgs[Math.min(1, userMsgs.length - 1)]?.content.slice(0, 40) ?? "otra cita placeholder";
  const cue1 = assistantMsgs[0]?.content.slice(0, 30);
  return JSON.stringify({
    synthesis: "Noté que te acercaste a Martina con calma y le diste espacio para hablar. Tuvieron un intercambio breve y honesto; volver a practicar te va a ayudar a afinar los detalles.",
    keyMoments: [
      {
        kind: "acierto",
        quote: q1,
        martinaCue: cue1,
        oasisPhase: "OBSERVA",
        whatHappenedWithMartina: "Martina soltó una respuesta corta pero abierta, con hesitación pero sin cerrarse.",
        whyItWorked: "Nombrar lo que ves sin apurar es el corazón de la fase Observa: le da a Martina la señal de que estás dispuesta a esperarla.",
      },
      {
        kind: "oportunidad",
        quote: q2,
        oasisPhase: "ACOGE",
        whatHappenedWithMartina: "El tema quedó en el aire y ella no llegó a nombrar cómo se siente.",
        tip: {
          advice: "Es muy natural querer avanzar rápido; con Martina la puerta se abre primero por reflejar lo que dijo — así ella siente que la escuchaste antes de proponer un paso.",
          examplePhrase: "Suena pesado eso que me cuentas. Cuéntame un poco más, si quieres.",
        },
      },
    ],
    strengthToKeep: "Sostuviste una escucha calma, sin llenar los silencios ni saltar a soluciones.",
    focusForNextAttempt: "Reflejar lo que Martina dice antes de proponer un paso siguiente.",
    reflectionPrompts: [
      "¿Qué notaste en ti mientras esperabas su respuesta?",
      "¿Qué recurso propio te gustaría tener a mano para la próxima conversación?",
    ],
    nextChallenge: "En tu próxima conversación con Martina, antes de proponer algo prueba reflejar con tus palabras lo que ella te acaba de decir.",
    mentorQuestion: "¿Cómo se practica el reflejo emocional en OASIS sin caer en repetir lo mismo que dijo la persona?",
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

  let parsed = JSON.parse(extractJsonObject(rawJson));
  let post = postProcessReport(parsed, fixture.messages);
  // Retry once on schema_invalid or moments_unverifiable with temperature=0.
  // Mirrors the retry logic in reportGenerator.ts. Only runs in --live.
  if (!post.ok && opts.live) {
    console.warn(
      `[${fixture.id}] first-pass FAIL — reason=${post.reason}; retrying at temperature=0`,
    );
    const { callFeedbackModel } = await import("../../src/session/reportGeneratorModel.js");
    const retry = await callFeedbackModel({
      prompt,
      model: opts.model,
      maxOutputTokens: 4096,
      thinkingBudget: opts.thinkingBudget,
      timeoutMs: 30_000,
      temperature: 0,
    });
    rawJson = retry.rawJson;
    parsed = JSON.parse(extractJsonObject(rawJson));
    post = postProcessReport(parsed, fixture.messages);
    console.log(`[${fixture.id}] retry finishReason=${retry.finishReason} latencyMs=${retry.latencyMs}`);
  }
  if (!post.ok) {
    console.warn(
      `[${fixture.id}] postProcess FAIL — reason=${post.reason} droppedMoments=${post.droppedMoments} droppedMartinaCues=${post.droppedMartinaCues}`,
    );
    if (post.reason === "schema_invalid") {
      const { FormativeReportContentSchema } = await import("@salvador/shared");
      const dbg = FormativeReportContentSchema.safeParse(parsed);
      if (!dbg.success) {
        console.warn(
          `[${fixture.id}] schema issues:`,
          dbg.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`),
        );
      }
    }
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
  // plain substring check. We EXCLUDE the trainee/Martina quotes from the
  // corpus checked here (they are verbatim citations, not mentor writing):
  // otherwise a fixture whose trainee says "me siento mal" would fail on
  // "mal" through no fault of the mentor.
  const contentBlob = JSON.stringify({
    synthesis: report.content.synthesis,
    strengthToKeep: report.content.strengthToKeep,
    focusForNextAttempt: report.content.focusForNextAttempt,
    reflectionPrompts: report.content.reflectionPrompts,
    nextChallenge: report.content.nextChallenge,
    mentorQuestion: report.content.mentorQuestion,
    keyMomentsMentorText: report.content.keyMoments.map((m) => ({
      whatHappenedWithMartina: m.whatHappenedWithMartina,
      ...(m.kind === "acierto"
        ? { whyItWorked: m.whyItWorked }
        : { advice: m.tip.advice, examplePhrase: m.tip.examplePhrase }),
    })),
  });
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

  // ── New coaching-shape assertions (Fase 4 paso 2, revised) ─────────────
  out.push({
    name: "first_moment_is_acierto",
    ok: moments[0]?.kind === "acierto",
    detail: moments[0]?.kind !== "acierto"
      ? `first moment kind=${moments[0]?.kind ?? "missing"} (expected acierto)` : undefined,
  });
  const oportunidades = moments.filter((m) => m.kind === "oportunidad");
  out.push({
    name: "max_two_oportunidades",
    ok: oportunidades.length <= 2,
    detail: oportunidades.length > 2 ? `got ${oportunidades.length}` : undefined,
  });
  const aciertos = moments.filter((m) => m.kind === "acierto");
  out.push({
    name: "aciertos_ge_oportunidades",
    ok: aciertos.length >= oportunidades.length,
    detail: aciertos.length < oportunidades.length
      ? `aciertos=${aciertos.length} oportunidades=${oportunidades.length}` : undefined,
  });
  // Every oportunidad carries a non-empty tip.advice + tip.examplePhrase.
  for (let i = 0; i < moments.length; i++) {
    const m = moments[i]!;
    if (m.kind === "oportunidad") {
      out.push({
        name: `tip_present_${i + 1}`,
        ok: m.tip.advice.trim().length > 0 && m.tip.examplePhrase.trim().length > 0,
        detail: undefined,
      });
    }
  }
  // Every acierto carries a non-empty whyItWorked.
  for (let i = 0; i < moments.length; i++) {
    const m = moments[i]!;
    if (m.kind === "acierto") {
      out.push({
        name: `whyItWorked_present_${i + 1}`,
        ok: m.whyItWorked.trim().length > 0,
      });
    }
  }
  // nextChallenge + mentorQuestion are non-empty.
  out.push({
    name: "nextChallenge_present",
    ok: report.content.nextChallenge.trim().length >= 20,
  });
  out.push({
    name: "mentorQuestion_present",
    ok: report.content.mentorQuestion.trim().length >= 10,
  });

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
    lines.push(`**nextChallenge**: ${report.content.nextChallenge}`);
    lines.push("");
    lines.push(`**mentorQuestion** _(prellenar Mentor)_: ${report.content.mentorQuestion}`);
    lines.push("");
    lines.push(`**reflectionPrompts**:`);
    for (const p of report.content.reflectionPrompts) lines.push(`- ${p}`);
    lines.push("");
    lines.push(`**keyMoments** (${report.content.keyMoments.length}):`);
    for (const m of report.content.keyMoments) {
      lines.push("");
      lines.push(`> **kind**: ${m.kind}`);
      lines.push(`> **quote**: "${m.quote}"`);
      if (m.martinaCue !== undefined) lines.push(`> **martinaCue**: "${m.martinaCue}"`);
      if (m.oasisPhase !== undefined) lines.push(`> **oasisPhase**: ${m.oasisPhase}`);
      lines.push(`> **whatHappenedWithMartina**: ${m.whatHappenedWithMartina}`);
      if (m.kind === "acierto") {
        lines.push(`> **whyItWorked**: ${m.whyItWorked}`);
      } else {
        lines.push(`> **tip.advice**: ${m.tip.advice}`);
        lines.push(`> **tip.examplePhrase** _(ejemplo sugerido, TODO_CLINICAL_VALIDATION)_: "${m.tip.examplePhrase}"`);
      }
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
