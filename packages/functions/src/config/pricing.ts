// Gemini 2.5 Flash pricing — validated May 2026
// Update this file when Google changes pricing. Add a debt entry with the date of change.
// Debt: docs/debt/0007-pricing-constants.md
export const GEMINI_PRICING = {
  model: "gemini-2.5-flash",
  inputPer1MTokens: 0.075,   // USD
  outputPer1MTokens: 0.30,   // USD
  validatedAt: "2026-05-12",
} as const;

export function calculateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * GEMINI_PRICING.inputPer1MTokens +
    (outputTokens / 1_000_000) * GEMINI_PRICING.outputPer1MTokens
  );
}
