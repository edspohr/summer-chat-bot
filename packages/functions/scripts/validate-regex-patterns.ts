// Manual runner for Layer 3 regex pattern self-test.
// Run: pnpm --filter @salvador/functions exec tsx scripts/validate-regex-patterns.ts

async function main(): Promise<void> {
  const { REGEX_PATTERNS } = await import("../src/safety/regexPreempt.js");
  console.log(`Validated ${REGEX_PATTERNS.length} patterns — all self-tests passed.`);
}

await main();
