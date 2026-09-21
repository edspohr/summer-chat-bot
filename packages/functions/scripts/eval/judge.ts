// LLM judge — informative only. Runs behind `--judge`. Never used to compute
// PASS/FAIL (that verdict is 100% deterministic; see checks.ts).
//
// The judge scores Martina's reply against the character brief the human
// reviewer would use:
//   - personaje: 0-5, "how in-character was the reply"
//   - revela_criterios: bool, "does it leak OASIS/tag names/methodology"
//   - adolescente_verosimil: bool, "does the register sound like a Chilean
//     16-year-old girl"
//   - razon: one-line prose reason
//
// Temperature 0, JSON output, own model. Failure to parse the judge output
// is logged and treated as `null` for the whole reply — the deterministic
// verdict is unaffected.

import { z } from "zod";

export const JUDGE_MODEL_DEFAULT = "gemini-2.5-flash";

export const JudgeVerdictSchema = z.object({
  personaje: z.number().min(0).max(5),
  revela_criterios: z.boolean(),
  adolescente_verosimil: z.boolean(),
  razon: z.string().min(1).max(240),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

const JUDGE_PROMPT = `Eres un revisor de simulaciones de entrenamiento en primeros auxilios emocionales.
Vas a evaluar UN turno de una personaje simulada (Martina, 16 años, adolescente chilena, retraída, con ideación pasiva).

Reglas:
- Puntúa 0-5 qué tan en personaje sonó la respuesta ("personaje"): 0 = rompe personaje o suena a AI/tutor; 5 = totalmente adolescente chilena verosímil.
- "revela_criterios": true si la respuesta menciona metodología, fases OASIS, nombres de tags, "evaluación", "criterio", o rompe el marco del ejercicio; false si mantiene el marco.
- "adolescente_verosimil": true si el registro (léxico, cadencia, chilenismos, largo, hesitaciones) es plausible para una adolescente chilena de 16; false si suena adulto, monólogo, formal o americano.
- "razon": una sola frase, máx 240 caracteres, explicando la nota. Español.

Devuelve SOLO JSON válido con las 4 claves. No agregues texto adicional.

Turno del aprendiz: <<TRAINEE>>

Respuesta de Martina: <<MARTINA>>
`;

export function buildJudgePrompt(trainee: string, martina: string): string {
  return JUDGE_PROMPT.replace("<<TRAINEE>>", trainee).replace("<<MARTINA>>", martina);
}

// Extract JSON from an LLM response that may wrap it in ```json fences or
// prose. Same logic as callB.ts::extractJsonObject.
function extractJsonObject(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) return s.slice(first, last + 1);
  return s;
}

export function parseJudgeVerdict(rawJson: string): JudgeVerdict | null {
  try {
    const parsed = JSON.parse(extractJsonObject(rawJson));
    return JudgeVerdictSchema.parse(parsed);
  } catch (err) {
    console.warn("[JUDGE] failed to parse verdict:", err);
    return null;
  }
}
