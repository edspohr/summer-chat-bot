import * as content from "./content.js";

const promptCache = new Map<string, string>();

/**
 * Loads a prompt by name.
 * In production, it uses the bundled strings to avoid filesystem issues.
 */
export async function loadPrompt(name: string): Promise<string> {
  const cached = promptCache.get(name);
  if (cached !== undefined) return cached;

  // Map the prompt name to the exported constant
  const promptContent = (content as any)[name];

  if (promptContent === undefined) {
    throw new Error(`Prompt "${name}" not found in bundled content.`);
  }

  promptCache.set(name, promptContent);
  return promptContent;
}

export function clearPromptCache(): void {
  promptCache.clear();
}
