// Pure-function tests for the Call B tolerant parser. No Firestore imports,
// so vitest stays clear of debt-0021.
import { describe, it, expect } from "vitest";
import { parseTolerantEvaluatorOutput, formatCallBSummary } from "./callBParse.js";

describe("parseTolerantEvaluatorOutput", () => {
  it("passes a fully-formed evaluator payload through with strictOk=true", () => {
    const parsed = {
      evaluated_tags: [
        {
          tag_id: "T_01",
          evidence_detected: true,
          confidence: 0.9,
          musts_met: ["m1"],
          musts_missing: [],
          outstanding_observed: true,
          anti_patterns_observed: [],
          observed_behaviors: ["b1"],
          justification: "ok",
        },
      ],
      matrixDelta: {
        deltaIntensidadEmocional: -1,
        deltaApertura: 1,
        deltaConfianzaEnLaAyuda: 1,
        tagsObservados: ["T_01"],
        antiPatronesDetectados: [],
        razonamientoBreve: "válido",
      },
    };
    const r = parseTolerantEvaluatorOutput(parsed);
    expect(r.strictOk).toBe(true);
    expect(r.discardedTags).toEqual([]);
    expect(r.matrixDeltaPresent).toBe(true);
    expect(r.output.evaluated_tags).toHaveLength(1);
    expect(r.output.matrixDelta).toBeDefined();
  });

  it("recovers a tag missing non-essential fields (defaults applied)", () => {
    const parsed = {
      evaluated_tags: [
        {
          tag_id: "T_02",
          evidence_detected: false,
          confidence: 0.2,
          // musts_met, musts_missing, anti_patterns_observed,
          // observed_behaviors, outstanding_observed, justification MISSING
        },
      ],
    };
    const r = parseTolerantEvaluatorOutput(parsed);
    expect(r.output.evaluated_tags).toHaveLength(1);
    expect(r.output.evaluated_tags[0]!.tag_id).toBe("T_02");
    expect(r.output.evaluated_tags[0]!.musts_met).toEqual([]);
    expect(r.output.evaluated_tags[0]!.outstanding_observed).toBe(false);
    expect(r.discardedTags).toEqual([]);
    // strict would have failed on the missing fields → strictOk=false.
    expect(r.strictOk).toBe(false);
    expect(r.strictIssues.length).toBeGreaterThan(0);
  });

  it("drops only the invalid tag and keeps the valid ones + matrixDelta", () => {
    const parsed = {
      evaluated_tags: [
        {
          tag_id: "T_01",
          evidence_detected: true,
          confidence: 0.7,
        },
        {
          // tag_id missing → essential field, drop this one
          evidence_detected: true,
          confidence: 0.5,
        },
        {
          tag_id: "T_03",
          evidence_detected: false,
          confidence: 0.1,
        },
      ],
      matrixDelta: {
        deltaIntensidadEmocional: 0,
        deltaApertura: 1,
        deltaConfianzaEnLaAyuda: 0,
        tagsObservados: [],
        antiPatronesDetectados: [],
        razonamientoBreve: "n/a",
      },
    };
    const r = parseTolerantEvaluatorOutput(parsed);
    expect(r.output.evaluated_tags.map((t) => t.tag_id)).toEqual(["T_01", "T_03"]);
    expect(r.discardedTags).toHaveLength(1);
    expect(r.discardedTags[0]!.index).toBe(1);
    expect(r.matrixDeltaPresent).toBe(true);
  });

  it("preserves matrixDelta when ALL tags are invalid", () => {
    const parsed = {
      evaluated_tags: [{ tag_id: "T_01" /* evidence_detected + confidence missing */ }],
      matrixDelta: {
        deltaIntensidadEmocional: -2,
        deltaApertura: 0,
        deltaConfianzaEnLaAyuda: "RESET_ZERO",
        tagsObservados: [],
        antiPatronesDetectados: ["anti"],
        razonamientoBreve: "reset",
      },
    };
    const r = parseTolerantEvaluatorOutput(parsed);
    expect(r.output.evaluated_tags).toEqual([]);
    expect(r.matrixDeltaPresent).toBe(true);
    expect(r.output.matrixDelta?.deltaConfianzaEnLaAyuda).toBe("RESET_ZERO");
    expect(r.discardedTags).toHaveLength(1);
  });

  it("returns matrixDeltaPresent=false when matrixDelta itself is malformed", () => {
    const parsed = {
      evaluated_tags: [],
      matrixDelta: { deltaIntensidadEmocional: 99 /* out of range */ },
    };
    const r = parseTolerantEvaluatorOutput(parsed);
    expect(r.matrixDeltaPresent).toBe(false);
    expect(r.output.matrixDelta).toBeUndefined();
  });

  it("handles a totally-broken payload (not an object) without throwing", () => {
    expect(() => parseTolerantEvaluatorOutput(null)).not.toThrow();
    expect(() => parseTolerantEvaluatorOutput("hello")).not.toThrow();
    const r = parseTolerantEvaluatorOutput(null);
    expect(r.output.evaluated_tags).toEqual([]);
    expect(r.matrixDeltaPresent).toBe(false);
  });

  it("captures a real flash-lite failure mode: missing observed_behaviors and justification on a non-detected tag", () => {
    // Copied from a dev log excerpt on 2026-09-15.
    const parsed = {
      evaluated_tags: [
        {
          tag_id: "T_05_SILENCIO_PRESENCIA_S03",
          evidence_detected: false,
          confidence: 0.05,
          musts_met: [],
          musts_missing: ["Deja pausa deliberada"],
          outstanding_observed: false,
          anti_patterns_observed: [],
          // observed_behaviors + justification omitted
        },
      ],
      matrixDelta: {
        deltaIntensidadEmocional: 0,
        deltaApertura: 0,
        deltaConfianzaEnLaAyuda: 0,
        tagsObservados: [],
        antiPatronesDetectados: [],
        razonamientoBreve: "sin señales",
      },
    };
    const r = parseTolerantEvaluatorOutput(parsed);
    expect(r.output.evaluated_tags).toHaveLength(1);
    expect(r.strictOk).toBe(false);
    // Before this fix, the whole payload became EMPTY_OUTPUT — matrix lost.
    expect(r.matrixDeltaPresent).toBe(true);
  });
});

describe("formatCallBSummary", () => {
  it("produces a compact greppable line", () => {
    const parsed = {
      evaluated_tags: [
        { tag_id: "T_01", evidence_detected: true, confidence: 0.8 },
      ],
      matrixDelta: {
        deltaIntensidadEmocional: 0,
        deltaApertura: 1,
        deltaConfianzaEnLaAyuda: 0,
        tagsObservados: [],
        antiPatronesDetectados: [],
        razonamientoBreve: "x",
      },
    };
    const r = parseTolerantEvaluatorOutput(parsed);
    const line = formatCallBSummary(r);
    expect(line).toContain("[COACH B]");
    expect(line).toContain("tags_valid=1");
    expect(line).toContain("tags_discarded=0");
    expect(line).toContain("matrix=yes");
    expect(line).toContain("strict=fail");
  });
});
