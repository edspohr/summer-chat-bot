// Deterministic checks per turn — sole source of the PASS/FAIL verdict.
// Nothing here calls an LLM. The judge (judge.ts) is informative only.
import type { EstadoMatriz } from "@salvador/shared";
import type { MatrixDirection, TurnExpectation } from "./schema.js";
import { DEFAULT_FORBIDDEN_STRINGS } from "./schema.js";

export interface CallARaw {
  content: string;
  frameBreakSuspected: boolean;
  finishReason: string | null;
  latencyMs: number;
}

export type CheckOutcome =
  | { name: string; kind: "pass" }
  | { name: string; kind: "fail"; message: string }
  | { name: string; kind: "skip"; reason: string };

export function directionOf(
  before: number,
  after: number,
  resetZero: boolean,
): MatrixDirection {
  if (resetZero) return "reset_zero";
  if (after > before) return "up";
  if (after < before) return "down";
  return "stable";
}

function directionMatches(
  expected: MatrixDirection,
  before: number,
  after: number,
  wasReset: boolean,
): boolean {
  if (expected === "reset_zero") return wasReset;
  if (expected === "up") return after > before;
  if (expected === "down") return after < before;
  // "stable" — the addendum caps most deltas at ±1 and biases toward small
  // positive movement in warm turns. A one-point drift either way is still
  // "stable" for fixture-review purposes. Larger movement fails the check.
  return Math.abs(after - before) <= 1;
}

export function runChecks(params: {
  turnIndex: number;
  callA: CallARaw;
  matrixBefore: EstadoMatriz;
  matrixAfter: EstadoMatriz;
  confianzaResetOccurred: boolean;
  expectation: TurnExpectation;
}): CheckOutcome[] {
  const { callA, matrixBefore, matrixAfter, confianzaResetOccurred, expectation } = params;
  const out: CheckOutcome[] = [];

  // Length
  const len = callA.content.length;
  if (len < expectation.martinaMinChars) {
    out.push({
      name: "length_min",
      kind: "fail",
      message: `Martina reply is ${len} chars, expected >= ${expectation.martinaMinChars}`,
    });
  } else if (len > expectation.martinaMaxChars) {
    out.push({
      name: "length_max",
      kind: "fail",
      message: `Martina reply is ${len} chars, expected <= ${expectation.martinaMaxChars}`,
    });
  } else {
    out.push({ name: "length", kind: "pass" });
  }

  // Truncation — accept "STOP" as OK; anything else (MAX_TOKENS, SAFETY, etc.) fails.
  if (callA.finishReason === null) {
    out.push({
      name: "finish_reason",
      kind: "skip",
      reason: "finishReason not exposed by SDK response in this run",
    });
  } else if (callA.finishReason.toUpperCase() === "STOP") {
    out.push({ name: "finish_reason", kind: "pass" });
  } else {
    out.push({
      name: "finish_reason",
      kind: "fail",
      message: `finishReason=${callA.finishReason} (expected STOP)`,
    });
  }

  // Frame-break tag
  if (expectation.requiresFrameBreakTag) {
    if (callA.frameBreakSuspected) {
      out.push({ name: "frame_break_tag", kind: "pass" });
    } else {
      out.push({
        name: "frame_break_tag",
        kind: "fail",
        message: "Call A did not emit [FRAME_BREAK_SUSPECTED]",
      });
    }
  } else if (callA.frameBreakSuspected) {
    out.push({
      name: "frame_break_tag",
      kind: "fail",
      message: "Call A emitted [FRAME_BREAK_SUSPECTED] but fixture did not expect it",
    });
  }

  // Forbidden strings
  const forbiddenList = [
    ...DEFAULT_FORBIDDEN_STRINGS,
    ...expectation.extraForbiddenStrings,
  ];
  const lowerContent = callA.content.toLowerCase();
  const hits = forbiddenList.filter((s) => lowerContent.includes(s.toLowerCase()));
  if (hits.length === 0) {
    out.push({ name: "no_forbidden_strings", kind: "pass" });
  } else {
    out.push({
      name: "no_forbidden_strings",
      kind: "fail",
      message: `Martina said: ${hits.map((h) => `"${h}"`).join(", ")}`,
    });
  }

  // Matrix direction — one check per variable that the fixture declares.
  const declared: [
    "intensidadEmocional" | "apertura" | "confianzaEnLaAyuda",
    MatrixDirection | undefined,
  ][] = [
    ["intensidadEmocional", expectation.matrix.intensidadEmocional],
    ["apertura", expectation.matrix.apertura],
    ["confianzaEnLaAyuda", expectation.matrix.confianzaEnLaAyuda],
  ];
  for (const [varName, expected] of declared) {
    if (expected === undefined) continue;
    const before = matrixBefore[varName];
    const after = matrixAfter[varName];
    const wasReset = varName === "confianzaEnLaAyuda" && confianzaResetOccurred;
    if (directionMatches(expected, before, after, wasReset)) {
      out.push({ name: `matrix_${varName}`, kind: "pass" });
    } else {
      const actual = directionOf(before, after, wasReset);
      out.push({
        name: `matrix_${varName}`,
        kind: "fail",
        message: `expected ${expected}, got ${actual} (${before} → ${after})`,
      });
    }
  }

  return out;
}

export function verdict(outcomes: CheckOutcome[]): "PASS" | "FAIL" {
  return outcomes.some((o) => o.kind === "fail") ? "FAIL" : "PASS";
}
