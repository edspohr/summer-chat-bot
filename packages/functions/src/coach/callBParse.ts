// Tolerant parser for Call B's evaluator output.
//
// flash-lite omits fields intermittently — 13/82 turns in Fase 2 baseline v0
// and 69/351 turns in the last 30 days of prod coachTurn logs landed in
// EMPTY_OUTPUT because the strict Zod schema threw on the whole payload.
// The engine lost tags AND the matrixDelta whenever a single tag object was
// short a field.
//
// The rules here:
//   - Essential per tag: tag_id, evidence_detected, confidence. If any is
//     missing/invalid, that tag is dropped and the drop is reported.
//   - Non-essential fields default (empty array, false, empty string).
//   - matrixDelta is parsed independently. A malformed tag never removes it.
//   - The function is pure and imports zero I/O so unit tests exercise it
//     without touching Firestore or Vertex.

import { z } from "zod";
import { MatrixDeltaSchema } from "@salvador/shared";
import type { EvaluatorRawOutput, MatrixDelta } from "@salvador/shared";

// Loose per-tag schema: essentials required, everything else defaulted.
const TolerantTagSchema = z.object({
  tag_id: z.string().min(1),
  evidence_detected: z.boolean(),
  confidence: z.number().min(0).max(1),
  musts_met: z.array(z.string()).default([]),
  musts_missing: z.array(z.string()).default([]),
  outstanding_observed: z.boolean().default(false),
  anti_patterns_observed: z.array(z.string()).default([]),
  observed_behaviors: z.array(z.string()).default([]),
  justification: z.string().default(""),
});

export interface DiscardedTagRecord {
  index: number;
  tagId: string | null;
  reasons: string[];
}

export interface TolerantParseResult {
  output: EvaluatorRawOutput;
  discardedTags: DiscardedTagRecord[];
  matrixDeltaPresent: boolean;
  strictOk: boolean;
  // Populated when strict validation failed. Each issue has a `path` string
  // like "evaluated_tags.3.confidence" — useful for finding which field
  // flash-lite is dropping.
  strictIssues: Array<{ path: string; message: string }>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseTolerantEvaluatorOutput(parsed: unknown): TolerantParseResult {
  const record = isRecord(parsed) ? parsed : {};
  const rawTags = Array.isArray(record["evaluated_tags"]) ? record["evaluated_tags"] : [];

  const validTags: EvaluatorRawOutput["evaluated_tags"] = [];
  const discardedTags: DiscardedTagRecord[] = [];
  for (let i = 0; i < rawTags.length; i++) {
    const r = TolerantTagSchema.safeParse(rawTags[i]);
    if (r.success) {
      validTags.push(r.data);
      continue;
    }
    const item = rawTags[i];
    const tagId = isRecord(item) && typeof item["tag_id"] === "string" ? item["tag_id"] : null;
    const reasons = r.error.issues.map(
      (iss) => `${iss.path.join(".")}: ${iss.message}`,
    );
    discardedTags.push({ index: i, tagId, reasons });
  }

  let matrixDelta: MatrixDelta | undefined;
  if (record["matrixDelta"] !== undefined) {
    const m = MatrixDeltaSchema.safeParse(record["matrixDelta"]);
    if (m.success) matrixDelta = m.data;
  }

  // Determine whether the strict schema would have accepted the full payload.
  // We report it so callers can log the strict-issues path list for triage
  // when it wouldn't have.
  const strictIssues: Array<{ path: string; message: string }> = [];
  let strictOk = discardedTags.length === 0 && rawTags.length === validTags.length;
  if (strictOk) {
    // Re-run against the full strict per-tag schema to catch the fields that
    // are required in strict but defaulted in tolerant (like musts_met).
    const strictTag = TolerantTagSchema.extend({
      musts_met: z.array(z.string()),
      musts_missing: z.array(z.string()),
      outstanding_observed: z.boolean(),
      anti_patterns_observed: z.array(z.string()),
      observed_behaviors: z.array(z.string()),
      justification: z.string(),
    });
    for (let i = 0; i < rawTags.length; i++) {
      const r = strictTag.safeParse(rawTags[i]);
      if (!r.success) {
        strictOk = false;
        for (const iss of r.error.issues) {
          strictIssues.push({
            path: `evaluated_tags.${i}.${iss.path.join(".")}`,
            message: iss.message,
          });
        }
      }
    }
  }

  const output: EvaluatorRawOutput = matrixDelta === undefined
    ? { evaluated_tags: validTags }
    : { evaluated_tags: validTags, matrixDelta };

  return {
    output,
    discardedTags,
    matrixDeltaPresent: matrixDelta !== undefined,
    strictOk,
    strictIssues,
  };
}

// Compact log line the coachHandler emits per turn. Kept as a helper so the
// shape stays consistent and greppable.
export function formatCallBSummary(result: TolerantParseResult): string {
  const parts = [
    `tags_valid=${result.output.evaluated_tags.length}`,
    `tags_discarded=${result.discardedTags.length}`,
    `matrix=${result.matrixDeltaPresent ? "yes" : "no"}`,
    `strict=${result.strictOk ? "ok" : "fail"}`,
  ];
  return `[COACH B] ${parts.join(" ")}`;
}
