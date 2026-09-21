import type { FixtureResult, TurnResult, RunnerOptions } from "./runner.js";

// Pure markdown emitter — no I/O. The CLI wires this into a file.

function pct(n: number, d: number): string {
  if (d === 0) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

function matrixRow(t: TurnResult): string {
  const b = t.matrixBefore;
  const a = t.matrixAfter;
  const arrow = (before: number, after: number): string =>
    before === after ? "=" : before < after ? "↑" : "↓";
  return [
    `${b.intensidadEmocional}${arrow(b.intensidadEmocional, a.intensidadEmocional)}${a.intensidadEmocional}`,
    `${b.apertura}${arrow(b.apertura, a.apertura)}${a.apertura}`,
    `${b.confianzaEnLaAyuda}${arrow(b.confianzaEnLaAyuda, a.confianzaEnLaAyuda)}${a.confianzaEnLaAyuda}${t.confianzaResetOccurred ? " (RESET)" : ""}`,
  ].join(" · ");
}

function checksLine(t: TurnResult): string {
  if (t.verdict === "ERROR") {
    return `**ERROR** (turn skipped): ${t.errorMessage ?? "unknown"}`;
  }
  const failures = t.checks.filter((c) => c.kind === "fail");
  if (failures.length === 0) {
    return `all ${t.checks.length} checks passed`;
  }
  return failures.map((f) => `**${f.name}**: ${f.kind === "fail" ? f.message : ""}`).join(" · ");
}

// Category attribution for each failed check name. The user wants three
// buckets in the summary so we can tell engine misbehavior from fixture
// mis-calibration from real infra breakage.
const ENGINE_CHECKS = new Set([
  "matrix_intensidadEmocional",
  "matrix_apertura",
  "matrix_confianzaEnLaAyuda",
  "frame_break_tag",
  "no_forbidden_strings",
  "finish_reason",
]);
const EXPECTATION_CHECKS = new Set(["length", "length_min", "length_max"]);

interface FailureCategories {
  engineFails: number;
  expectationFails: number;
  infraErrors: number;
}

function categorizeTurn(t: TurnResult, acc: FailureCategories): void {
  if (t.verdict === "ERROR") {
    acc.infraErrors += 1;
    return;
  }
  const failed = t.checks.filter((c) => c.kind === "fail");
  const engine = failed.filter((c) => ENGINE_CHECKS.has(c.name)).length;
  const expectation = failed.filter((c) => EXPECTATION_CHECKS.has(c.name)).length;
  if (engine > 0) acc.engineFails += 1;
  if (expectation > 0) acc.expectationFails += 1;
}

function judgeLine(t: TurnResult): string {
  if (t.judge === undefined) return "";
  if (t.judge === null) return "_(judge output unparseable)_";
  const j = t.judge;
  return `personaje ${j.personaje}/5 · revela_criterios=${j.revela_criterios} · adolescente_verosimil=${j.adolescente_verosimil} — ${j.razon}`;
}

export function renderReport(
  results: FixtureResult[],
  opts: RunnerOptions,
  startedAtIso: string,
): string {
  const lines: string[] = [];
  lines.push(`# Eval baseline — ${opts.live ? "LIVE" : "dry-run"}`);
  lines.push("");
  lines.push(`- Timestamp: ${startedAtIso}`);
  lines.push(`- Mode: ${opts.live ? "**--live** (real Vertex calls)" : "--dry-run"}`);
  lines.push(`- Repeats per fixture: ${opts.repeats}`);
  lines.push(`- Model A (Martina): \`${opts.modelA}\``);
  lines.push(`- Model B (evaluator): \`${opts.modelB}\``);
  lines.push(`- Judge LLM: ${opts.judge ? `enabled (\`${opts.judgeModel}\`)` : "disabled"}`);
  lines.push("");

  // Aggregate summary — three separate turn-level counters so the reader can
  // tell engine misbehavior from fixture mis-calibration from real infra
  // breakage. See categorizeTurn().
  let totalRuns = 0;
  let passRuns = 0;
  let failRuns = 0;
  let errorRuns = 0;
  let totalTurns = 0;
  const cat: FailureCategories = { engineFails: 0, expectationFails: 0, infraErrors: 0 };
  let judgeCalls = 0;
  let judgeVsCheckDisagreements = 0;
  for (const r of results) {
    for (const run of r.runs) {
      totalRuns++;
      if (run.verdict === "PASS") passRuns++;
      else if (run.verdict === "FAIL") failRuns++;
      else errorRuns++;
      for (const t of run.turns) {
        totalTurns++;
        categorizeTurn(t, cat);
        if (t.judge !== undefined && t.judge !== null) {
          judgeCalls++;
          const deterministicSaysOk = t.verdict === "PASS";
          const judgeSaysOk = t.judge.personaje >= 3 && !t.judge.revela_criterios && t.judge.adolescente_verosimil;
          if (deterministicSaysOk !== judgeSaysOk) judgeVsCheckDisagreements++;
        }
      }
    }
  }

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Fixtures: ${results.length}`);
  lines.push(`- Runs: ${totalRuns} — ${passRuns} PASS · ${failRuns} FAIL · ${errorRuns} ERROR (${pct(passRuns, totalRuns)} pass rate)`);
  lines.push(`- Turns: ${totalTurns}`);
  lines.push("");
  lines.push("Failure attribution (turn-level):");
  lines.push(`- **Engine failures** — matrix direction, frame-break tag, forbidden strings, finish reason: **${cat.engineFails}** turn(s) affected.`);
  lines.push(`- **Fixture expectation failures** — length bounds outside the addendum's tolerance: **${cat.expectationFails}** turn(s) affected.`);
  lines.push(`- **Infra errors** — Vertex timeout, JSON parse error, exceptions: **${cat.infraErrors}** turn(s) skipped.`);
  if (opts.judge) {
    lines.push(
      `- Judge vs deterministic disagreement: ${judgeVsCheckDisagreements}/${judgeCalls} (${pct(judgeVsCheckDisagreements, judgeCalls)})`,
    );
  }
  lines.push("");

  for (const r of results) {
    lines.push(`## ${r.fixture.id} — ${r.fixture.title}`);
    lines.push("");
    lines.push(`_${r.fixture.description}_`);
    lines.push("");
    lines.push(`Repeats: ${r.runs.length}`);
    lines.push("");

    for (const run of r.runs) {
      lines.push(`### Run #${run.runIndex + 1} — ${run.verdict}`);
      lines.push("");
      for (const t of run.turns) {
        lines.push(`**Turn ${t.turnIndex + 1}** — ${t.verdict}`);
        lines.push("");
        lines.push(`- Aprendiz: _${t.trainee}_`);
        lines.push(
          `- Martina (${t.martina.length} chars, ${t.latencyMs}ms${t.frameBreakSuspected ? ", **frame-break tag**" : ""}): ${t.martina.slice(0, 500)}${t.martina.length > 500 ? "…" : ""}`,
        );
        lines.push(`- Matriz (intensidad · apertura · confianza): ${matrixRow(t)}`);
        lines.push(
          `- Delta: ΔI=${t.delta.deltaIntensidadEmocional} ΔA=${t.delta.deltaApertura} ΔC=${String(t.delta.deltaConfianzaEnLaAyuda)}${t.delta.tagsObservados.length > 0 ? ` · tags=${t.delta.tagsObservados.join(",")}` : ""}${t.delta.antiPatronesDetectados.length > 0 ? ` · anti=${t.delta.antiPatronesDetectados.join(",")}` : ""}`,
        );
        lines.push(`- Checks: ${checksLine(t)}`);
        if (opts.judge) lines.push(`- Judge LLM (informativo, NO validación clínica): ${judgeLine(t)}`);
        lines.push("");
      }
    }
  }

  if (opts.judge) {
    lines.push("---");
    lines.push("");
    lines.push("## Juez LLM — no es validación clínica");
    lines.push("");
    lines.push(
      "El juez usa `gemini-2.5-flash` con temperature 0. Su salida es informativa: NO decide el PASS/FAIL del fixture. Un cuadro de mando trae la tasa de desacuerdo con los chequeos deterministas — cuanto mayor sea, menos confiable es el juez y menos peso debe dársele.",
    );
    lines.push("");
    lines.push(
      `Desacuerdo total en esta corrida: ${judgeVsCheckDisagreements}/${judgeCalls} (${pct(judgeVsCheckDisagreements, judgeCalls)}).`,
    );
  }

  return lines.join("\n") + "\n";
}
