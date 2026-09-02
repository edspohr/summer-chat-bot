// Canonical OASIS phase order and tag-id → phase parser.
// Moved from packages/web/src/lib/oasisPhase.ts so the export script and any
// other consumer can share the same mapping (per CLAUDE.md §3: cross-package
// shared logic lives in @salvador/shared).

import type { OasisPhase } from "../schemas/tag.schema.js";

// `console` is available in both browsers and Node but not in the ES2022 lib
// set used by @salvador/shared. Declare the minimal shape we use here so we
// don't have to pull in @types/node or dom.
declare const console: { warn(msg: string): void };

export const OASIS_PHASES_IN_ORDER: readonly OasisPhase[] = [
  "OBSERVA",
  "ACOGE",
  "SILENCIO",
  "ILUMINA",
  "SOSTEN",
] as const;

const DIACRITICS = /[̀-ͯ]/g;

function normalise(segment: string): string {
  return segment.toUpperCase().normalize("NFD").replace(DIACRITICS, "");
}

const KNOWN = new Set<string>(OASIS_PHASES_IN_ORDER);
const warned = new Set<string>();

// Tag IDs follow the convention T_NN_<PHASE>_<LABEL>_S<NN>
// (e.g. T_01_OBSERVA_SENALES_S03). Parser is tolerant: accent-insensitive
// and case-insensitive. Unknown phases log once and return null; callers
// group these under an "unknown" bucket rather than silently dropping them.
export function phaseFromTagId(tagId: string): OasisPhase | null {
  const parts = tagId.split("_");
  const raw = parts[2];
  if (raw === undefined) {
    if (!warned.has(tagId)) {
      warned.add(tagId);
      console.warn(`[oasisPhase] tag id has unexpected shape: ${tagId}`);
    }
    return null;
  }
  const candidate = normalise(raw);
  if (KNOWN.has(candidate)) return candidate as OasisPhase;
  if (!warned.has(tagId)) {
    warned.add(tagId);
    console.warn(`[oasisPhase] unknown phase segment "${raw}" in tag id ${tagId}`);
  }
  return null;
}
