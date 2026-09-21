// Fase 2 eval runner core. Loads a fixture and simulates the coach turn
// pipeline in memory — no Firestore, no callable, no session writes.
//
// --dry-run  (default): uses the fixture's `dryRunMartina` field for Call A
//            and synthesizes a plausible matrix delta from the fixture's
//            expected direction. Zero Vertex calls, zero cost.
// --live     hits Vertex for Call A and Call B in sequence (never in
//            parallel here — the runner is not the product). Applies the
//            existing vertexRetry policy.

import type {
  ConversationTurn,
  EstadoMatriz,
  EvaluatorRawOutput,
  MatrixDelta,
  Scenario,
  TagDefinition,
} from "@salvador/shared";
import { MARTINA_INITIAL_MATRIX } from "@salvador/shared";
import type { CallARaw } from "./checks.js";
import { runChecks, verdict } from "./checks.js";
import type { Fixture, FixtureTurn, MatrixDirection } from "./schema.js";
import { applyMatrixDelta } from "../../src/coach/matrixApply.js";
import type { JudgeVerdict } from "./judge.js";

export interface RunnerOptions {
  live: boolean;
  repeats: number;
  modelA: string;
  modelB: string;
  judge: boolean;
  judgeModel: string;
}

export interface TurnResult {
  turnIndex: number;
  trainee: string;
  martina: string;
  frameBreakSuspected: boolean;
  finishReason: string | null;
  latencyMs: number;
  matrixBefore: EstadoMatriz;
  matrixAfter: EstadoMatriz;
  delta: MatrixDelta;
  confianzaResetOccurred: boolean;
  checks: ReturnType<typeof runChecks>;
  verdict: "PASS" | "FAIL";
  judge?: JudgeVerdict | null;
}

export interface FixtureRun {
  runIndex: number;
  turns: TurnResult[];
  verdict: "PASS" | "FAIL";
}

export interface FixtureResult {
  fixture: Fixture;
  runs: FixtureRun[];
}

// ── Synthesis for dry-run ─────────────────────────────────────────────────

// Produces a MatrixDelta that will move each variable in the expected
// direction, so the checks pass end-to-end without Vertex. Meaningful only
// for shaking out the runner itself — never used in --live.
export function synthesizeDryDelta(fixtureTurn: FixtureTurn): MatrixDelta {
  const dirTo = (
    d: MatrixDirection | undefined,
  ): number | "RESET_ZERO" => {
    if (d === undefined || d === "stable") return 0;
    if (d === "up") return 1;
    if (d === "down") return -1;
    return "RESET_ZERO";
  };
  const dI = dirTo(fixtureTurn.expected.matrix.intensidadEmocional);
  const dA = dirTo(fixtureTurn.expected.matrix.apertura);
  const dC = dirTo(fixtureTurn.expected.matrix.confianzaEnLaAyuda);
  return {
    deltaIntensidadEmocional: typeof dI === "number" ? dI : 0,
    deltaApertura: typeof dA === "number" ? dA : 0,
    deltaConfianzaEnLaAyuda: dC === "RESET_ZERO" ? "RESET_ZERO" : (typeof dC === "number" ? dC : 0),
    tagsObservados: [],
    antiPatronesDetectados: [],
    razonamientoBreve: "[dry-run synthetic]",
  };
}

// ── Runner ────────────────────────────────────────────────────────────────

// The runner is generic over the Call A / Call B / judge functions so tests
// can inject deterministic stubs and --live plugs in the real Vertex calls.
export interface RunnerDeps {
  callA(input: {
    scenario: Scenario;
    emotionalState: { emotionalIntensity: number; openness: number; trustInHelp: number };
    conversationHistory: ConversationTurn[];
    traineeMessage: string;
    promptVersion: string;
  }): Promise<CallARaw>;
  callB(input: {
    pendingTags: TagDefinition[];
    scenarioContextSummary: string;
    conversationHistory: ConversationTurn[];
    traineeTurn: string;
    promptVersion: string;
  }): Promise<EvaluatorRawOutput>;
  judge?(trainee: string, martina: string): Promise<JudgeVerdict | null>;
}

export async function runFixture(
  fixture: Fixture,
  scenario: Scenario,
  tagDefinitions: TagDefinition[],
  runIndex: number,
  opts: RunnerOptions,
  deps: RunnerDeps,
): Promise<FixtureRun> {
  let matrix: EstadoMatriz = { ...MARTINA_INITIAL_MATRIX };
  const history: ConversationTurn[] = [
    { role: "assistant", content: scenario.seedMessage, turnNumber: 0 },
  ];
  const turns: TurnResult[] = [];

  for (let i = 0; i < fixture.turns.length; i++) {
    const t = fixture.turns[i]!;
    const emotionalState = {
      emotionalIntensity: matrix.intensidadEmocional,
      openness: matrix.apertura,
      trustInHelp: matrix.confianzaEnLaAyuda,
    };

    const callAResult = await deps.callA({
      scenario,
      emotionalState,
      conversationHistory: history,
      traineeMessage: t.trainee,
      promptVersion: "coach_conversational_v1",
    });

    // Call B (evaluator) with includeMatrix=true so we always get a delta.
    const callBOutput = await deps.callB({
      pendingTags: tagDefinitions,
      scenarioContextSummary: buildScenarioContextSummary(scenario, emotionalState),
      conversationHistory: history,
      traineeTurn: t.trainee,
      promptVersion: "coach_evaluator_v1",
    });

    // In dry-run, override the (empty) mock delta with a synthesized one so
    // matrix direction checks fire against the fixture expectation. --live
    // uses whatever the model produced.
    const delta: MatrixDelta =
      opts.live && callBOutput.matrixDelta !== undefined
        ? callBOutput.matrixDelta
        : synthesizeDryDelta(t);

    const matrixBefore = matrix;
    const confianzaResetOccurred = delta.deltaConfianzaEnLaAyuda === "RESET_ZERO";
    matrix = applyMatrixDelta(matrix, delta);

    const checks = runChecks({
      turnIndex: i,
      callA: callAResult,
      matrixBefore,
      matrixAfter: matrix,
      confianzaResetOccurred,
      expectation: t.expected,
    });
    const turnVerdict = verdict(checks);

    const turnResult: TurnResult = {
      turnIndex: i,
      trainee: t.trainee,
      martina: callAResult.content,
      frameBreakSuspected: callAResult.frameBreakSuspected,
      finishReason: callAResult.finishReason,
      latencyMs: callAResult.latencyMs,
      matrixBefore,
      matrixAfter: matrix,
      delta,
      confianzaResetOccurred,
      checks,
      verdict: turnVerdict,
    };

    if (opts.judge && deps.judge !== undefined) {
      turnResult.judge = await deps.judge(t.trainee, callAResult.content);
    }
    turns.push(turnResult);

    history.push({ role: "user", content: t.trainee, turnNumber: history.length });
    history.push({
      role: "assistant",
      content: callAResult.content,
      turnNumber: history.length,
    });
  }

  const runVerdict: "PASS" | "FAIL" = turns.some((t) => t.verdict === "FAIL")
    ? "FAIL"
    : "PASS";
  return { runIndex, turns, verdict: runVerdict };
}

// Local copy of coachHandler.ts::buildScenarioContextSummary to avoid pulling
// db imports. Keep in sync — if the format changes there, mirror here.
function buildScenarioContextSummary(
  scenario: Scenario,
  emotionalState: { emotionalIntensity: number; openness: number; trustInHelp: number },
): string {
  return [
    `Personaje: ${scenario.persona.name}, ${scenario.persona.age} años (${scenario.persona.role}).`,
    `Situación inicial: ${scenario.initialSituation}`,
    `Estado emocional actual — intensidad ${emotionalState.emotionalIntensity}/10, apertura ${emotionalState.openness}/10, confianza en la ayuda ${emotionalState.trustInHelp}/10.`,
  ].join("\n");
}
