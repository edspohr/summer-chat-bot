import { describe, it, expect } from "vitest";
import { checkRegexPatterns, REGEX_PATTERNS } from "./regexPreempt.js";

// Validates that every pattern's embedded examples behave as declared.
// This mirrors the module-load self-test but runs as named test cases
// so CI output identifies exactly which example and pattern fail.

describe("Layer 3 regex patterns — self-test examples", () => {
  for (const p of REGEX_PATTERNS) {
    describe(p.category, () => {
      for (const ex of p.examplesMatched) {
        it(`matches: "${ex}"`, () => {
          expect(p.pattern.test(ex)).toBe(true);
        });
      }
      for (const ex of p.examplesNotMatched) {
        it(`does not match: "${ex}"`, () => {
          expect(p.pattern.test(ex)).toBe(false);
        });
      }
    });
  }
});

describe("checkRegexPatterns", () => {
  it("returns null when no pattern matches", () => {
    expect(checkRegexPatterns("Creo que deberías llamar a alguien")).toBeNull();
    expect(checkRegexPatterns("¿Cómo se aplica la fase Acoge?")).toBeNull();
    expect(checkRegexPatterns("Estoy aquí, te escucho")).toBeNull();
  });

  it("returns the matching category for SUICIDAL_IDEATION_ACTIVE", () => {
    expect(checkRegexPatterns("quiero matarme")).toBe("SUICIDAL_IDEATION_ACTIVE");
    expect(checkRegexPatterns("me quiero suicidar")).toBe("SUICIDAL_IDEATION_ACTIVE");
  });

  it("returns the matching category for SUICIDAL_RUMINATION_ACTIVE", () => {
    expect(checkRegexPatterns("estoy pensando en suicidarme")).toBe("SUICIDAL_RUMINATION_ACTIVE");
  });

  it("returns the matching category for SELF_HARM_ACTIVE", () => {
    expect(checkRegexPatterns("me estoy haciendo daño")).toBe("SELF_HARM_ACTIVE");
    expect(checkRegexPatterns("me estoy cortando las muñecas")).toBe("SELF_HARM_ACTIVE");
  });

  it("returns the matching category for MEANS_WITH_INTENT", () => {
    expect(checkRegexPatterns("tengo pastillas para matarme")).toBe("MEANS_WITH_INTENT");
  });

  it("returns the matching category for MEANS_USED_INGESTION", () => {
    expect(checkRegexPatterns("me tomé las pastillas para matarme")).toBe("MEANS_USED_INGESTION");
  });

  it("is case-insensitive", () => {
    expect(checkRegexPatterns("QUIERO MATARME")).toBe("SUICIDAL_IDEATION_ACTIVE");
    expect(checkRegexPatterns("Me Quiero Suicidar")).toBe("SUICIDAL_IDEATION_ACTIVE");
  });

  it("does not trigger on third-person references", () => {
    expect(checkRegexPatterns("ella quiere matarse")).toBeNull();
    expect(checkRegexPatterns("está pensando en suicidarse")).toBeNull();
  });

  it("does not trigger on conditional/hypothetical phrasing", () => {
    expect(checkRegexPatterns("si quisiera matarme lo hubiera hecho")).toBeNull();
    expect(checkRegexPatterns("quisiera suicidarme pero no puedo")).toBeNull();
  });

  it("does not trigger on figurative expressions", () => {
    expect(checkRegexPatterns("tengo ganas de matarme de la vergüenza")).toBeNull();
    expect(checkRegexPatterns("me bebí el café para no morir de sueño")).toBeNull();
  });

  it("does not trigger on roleplay-framed phrases", () => {
    expect(checkRegexPatterns("en el roleplay el personaje quiere acabar con su vida")).toBeNull();
  });
});
