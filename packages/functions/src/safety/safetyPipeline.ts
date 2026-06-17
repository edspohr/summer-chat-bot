import type { SafetyCheckInput, SafetyCheckResult } from "@salvador/shared";
import { checkRegexPatterns } from "./regexPreempt.js";
import { classifyMessage } from "./llmClassifier.js";

// Phase 0 stub: orchestration logic stubbed. Full implementation is Phase 1.
// Flow: Layer3 (sync) → Layer2 (if frameBreakSuspected or Coach) → result
// INVARIANT: never throw exceptions outward.
// If classifier fails: isSafe=true + error log (fail-safe).
export async function runSafetyPipeline(
  input: SafetyCheckInput
): Promise<SafetyCheckResult> {
  const patternMatched = checkRegexPatterns(input.message);
  if (patternMatched !== null) {
    return {
      isSafe: false,
      layer: "L3",
      classification: "S",
      template: "REAL_DISTRESS",
      patternMatched,
    };
  }

  const shouldRunL2 =
    input.frameBreakSuspected || input.mode === "coach";

  if (shouldRunL2) {
    try {
      const classification = await classifyMessage({
        message: input.message,
        lastTurns: input.lastTurns,
        mode: input.mode,
      });

      if (classification === "S") {
        return {
          isSafe: false,
          layer: "L2",
          classification,
          template: "REAL_DISTRESS",
          patternMatched: null,
        };
      }
      if (classification === "D") {
        return {
          isSafe: false,
          layer: "L2",
          classification,
          template: "FRAME_BREAK",
          patternMatched: null,
        };
      }
      return {
        isSafe: true,
        layer: "L2",
        classification,
        template: null,
        patternMatched: null,
      };
    } catch (err) {
      console.error("[SAFETY L2] Classifier failed — fail-safe: isSafe=true", err);
    }
  }

  return {
    isSafe: true,
    layer: null,
    classification: "N",
    template: null,
    patternMatched: null,
  };
}
