import type { OasisPhase } from "@salvador/shared";

// Tag IDs follow the convention T_NN_<PHASE>_<LABEL>_S<NN>
// (e.g. T_01_OBSERVA_SENALES_S03). We derive the OASIS phase from the ID
// so the client does not have to read tag_definitions (which is not
// exposed by firestore.rules — no rule for that collection).
//
// Parser is tolerant: accent-insensitive and case-insensitive, so a future
// tag written as `T_09_sosten_...` or `T_10_SOSTÉN_...` still resolves.
// Unknown phases log a console.warn and return null; callers group these
// under an "unknown" bucket rather than silently dropping them.

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

export function phaseFromTagId(tagId: string): OasisPhase | null {
  const parts = tagId.split("_");
  // Expected shape: [T, NN, PHASE, ...LABEL, SNN]. Phase always at index 2.
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
