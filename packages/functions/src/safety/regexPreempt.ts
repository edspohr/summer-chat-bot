// PENDING CLINICAL VALIDATION — see docs/debt/0003-safety-regex-clinical-validation.md
// All patterns require co-validation with Fundación Summer clinical team before production.
// Discipline per architecture doc:
//   1. First-person, present or recent-past tense only. Never conditional or hypothetical.
//   2. Minimum 5 examplesMatched + 5 examplesNotMatched per pattern.
//   3. Self-test runs at module load.
//   4. When in doubt: omit — Layer 2 covers ambiguous cases.

export interface RegexPattern {
  pattern: RegExp;
  category: string;
  description: string;
  examplesMatched: string[];
  examplesNotMatched: string[];
}

const patterns: RegexPattern[] = [
  {
    pattern:
      /\bquiero\s+(matarme|suicidarme|quitarme\s+la\s+vida|acabar\s+con\s+mi\s+vida)\b|me\s+quiero\s+(matar|suicidar)\b/i,
    category: "SUICIDAL_IDEATION_ACTIVE",
    description: "First-person present-tense suicidal intent: 'quiero matarme' variants",
    examplesMatched: [
      "quiero matarme",
      "quiero suicidarme",
      "quiero quitarme la vida",
      "quiero acabar con mi vida",
      "me quiero matar",
      "me quiero suicidar",
    ],
    examplesNotMatched: [
      "quisiera matarme si las cosas fueran diferentes",
      "ella quiere matarse",
      "¿cómo ayudar a alguien que quiere matarse?",
      "en el roleplay el personaje quiere acabar con su vida",
      "no quiero vivir así",
      "queremos que nadie se suicide",
    ],
  },
  {
    pattern:
      /\bestoy\s+pensando\s+en\s+(matarme|suicidarme|quitarme\s+la\s+vida|acabar\s+con\s+mi\s+vida)\b/i,
    category: "SUICIDAL_RUMINATION_ACTIVE",
    description: "First-person present active rumination: 'estoy pensando en matarme'",
    examplesMatched: [
      "estoy pensando en matarme",
      "estoy pensando en suicidarme",
      "estoy pensando en quitarme la vida",
      "estoy pensando en acabar con mi vida",
      "hoy estoy pensando en matarme",
    ],
    examplesNotMatched: [
      "estuve pensando en matarme el año pasado",
      "está pensando en suicidarse",
      "en este ejercicio estoy pensando en cómo responder",
      "he estado pensando en lo que aprendí",
      "estoy pensando en cómo mejorar mi técnica",
    ],
  },
  {
    pattern:
      /\bme\s+estoy\s+haciendo\s+daño\b|me\s+estoy\s+(cortando|quemando|hiriendo)\s+(?:l[ao]s?\s+)?(muñecas?|venas?|brazos?|piernas?|piel|manos?)\b/i,
    category: "SELF_HARM_ACTIVE",
    description:
      "First-person present active self-harm with body-part anchor, or explicit 'me estoy haciendo daño'",
    examplesMatched: [
      "me estoy haciendo daño",
      "me estoy cortando las muñecas",
      "me estoy cortando los brazos",
      "me estoy quemando los brazos",
      "me estoy hiriendo las piernas",
    ],
    examplesNotMatched: [
      "me estoy cortando el pelo",
      "se está haciendo daño",
      "me corté ayer accidentalmente",
      "estoy preocupado de hacerle daño a alguien más",
      "me estoy quemando con el sol en la playa",
    ],
  },
  {
    pattern:
      /\btengo\s+.{0,40}para\s+(matarme|suicidarme|quitarme\s+la\s+vida)\b/i,
    category: "MEANS_WITH_INTENT",
    description: "First-person possession of means with explicit lethal intent: 'tengo X para matarme'",
    examplesMatched: [
      "tengo pastillas para matarme",
      "tengo un cuchillo para matarme",
      "tengo veneno para suicidarme",
      "tengo una cuerda para matarme",
      "tengo lo que necesito para quitarme la vida",
    ],
    examplesNotMatched: [
      "ella tiene pastillas para matarse",
      "tengo miedo de matarme si no duermo",
      "tengo ganas de matarme de la vergüenza",
      "tengo pastillas para el dolor",
      "tengo un cuchillo para cocinar",
    ],
  },
  {
    pattern:
      /\bme\s+(?:tomé|bebí|ingerí|tragué)\s+.{0,60}\bpara\s+(?:matarme|morir|suicidarme|acabar)\b/i,
    category: "MEANS_USED_INGESTION",
    description: "First-person recent ingestion of substance with explicit lethal intent",
    examplesMatched: [
      "me tomé las pastillas para matarme",
      "me bebí el veneno para morir",
      "me ingerí los medicamentos para suicidarme",
      "me tragué las píldoras para acabar",
      "me tomé todo lo que había para matarme",
    ],
    examplesNotMatched: [
      "me tomé las pastillas para dormir bien",
      "me tomé un vaso de agua para no morir de calor",
      "ella se tomó las pastillas para matarse",
      "me tomé las pastillas para el dolor de cabeza",
      "me bebí el café para no morir de sueño",
    ],
  },
];

function runSelfTest(patternList: RegexPattern[]): void {
  for (const p of patternList) {
    for (const ex of p.examplesMatched) {
      if (!p.pattern.test(ex)) {
        throw new Error(
          `[L3 SELF-TEST FAIL] ${p.category} should match: "${ex}"`
        );
      }
    }
    for (const ex of p.examplesNotMatched) {
      if (p.pattern.test(ex)) {
        throw new Error(
          `[L3 SELF-TEST FAIL] ${p.category} should NOT match: "${ex}"`
        );
      }
    }
  }
}

runSelfTest(patterns);

export function checkRegexPatterns(message: string): string | null {
  for (const p of patterns) {
    if (p.pattern.test(message)) {
      return p.category;
    }
  }
  return null;
}

export { patterns as REGEX_PATTERNS };
