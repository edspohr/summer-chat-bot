import { describe, it, expect } from "vitest";
import { applyMatrixDelta } from "./matrixEngine.js";
import type { EstadoMatriz, MatrixDelta } from "@salvador/shared";

const BASE: EstadoMatriz = {
  intensidadEmocional: 8,
  apertura: 5,
  confianzaEnLaAyuda: 2,
  pisoIntensidadActivo: true,
  derivacionAcordada: false,
};

const zeroDelta: MatrixDelta = {
  deltaIntensidadEmocional: 0,
  deltaApertura: 0,
  deltaConfianzaEnLaAyuda: 0,
  tagsObservados: [],
  antiPatronesDetectados: [],
  razonamientoBreve: "sin cambios",
};

describe("applyMatrixDelta — clamping", () => {
  it("does not exceed 10 on any variable", () => {
    const result = applyMatrixDelta(
      { ...BASE, intensidadEmocional: 9, apertura: 9, confianzaEnLaAyuda: 9 },
      { ...zeroDelta, deltaIntensidadEmocional: 3, deltaApertura: 3, deltaConfianzaEnLaAyuda: 3 },
    );
    expect(result.intensidadEmocional).toBe(10);
    expect(result.apertura).toBe(10);
    expect(result.confianzaEnLaAyuda).toBe(10);
  });

  it("does not go below 1 on apertura", () => {
    const result = applyMatrixDelta(
      { ...BASE, apertura: 1 },
      { ...zeroDelta, deltaApertura: -3 },
    );
    expect(result.apertura).toBe(1);
  });
});

describe("applyMatrixDelta — intensidadEmocional floor", () => {
  it("enforces floor of 5 when piso is active", () => {
    const result = applyMatrixDelta(
      { ...BASE, intensidadEmocional: 6 },
      { ...zeroDelta, deltaIntensidadEmocional: -3 },
    );
    // piso active (trustInHelp < 7 AND derivacionAcordada = false)
    expect(result.intensidadEmocional).toBe(5);
    expect(result.pisoIntensidadActivo).toBe(true);
  });

  it("allows drop below 5 when both floor conditions are met", () => {
    const result = applyMatrixDelta(
      {
        ...BASE,
        intensidadEmocional: 6,
        confianzaEnLaAyuda: 8,
        derivacionAcordada: true,
        pisoIntensidadActivo: false,
      },
      { ...zeroDelta, deltaIntensidadEmocional: -3 },
    );
    expect(result.intensidadEmocional).toBe(3);
    expect(result.pisoIntensidadActivo).toBe(false);
  });

  it("floor stays active when only one condition is met", () => {
    // confianza = 8 but derivacion not agreed
    const result = applyMatrixDelta(
      { ...BASE, intensidadEmocional: 6, confianzaEnLaAyuda: 8, derivacionAcordada: false },
      { ...zeroDelta, deltaIntensidadEmocional: -3 },
    );
    expect(result.intensidadEmocional).toBe(5);
    expect(result.pisoIntensidadActivo).toBe(true);
  });
});

describe("applyMatrixDelta — confianzaEnLaAyuda RESET_ZERO", () => {
  it("resets confianza to 0 on RESET_ZERO regardless of accumulated value", () => {
    const result = applyMatrixDelta(
      { ...BASE, confianzaEnLaAyuda: 9 },
      { ...zeroDelta, deltaConfianzaEnLaAyuda: "RESET_ZERO" },
    );
    expect(result.confianzaEnLaAyuda).toBe(0);
  });

  it("re-activates the intensity floor after RESET_ZERO drops confianza below 7", () => {
    const result = applyMatrixDelta(
      {
        ...BASE,
        confianzaEnLaAyuda: 9,
        derivacionAcordada: true,
        pisoIntensidadActivo: false,
      },
      { ...zeroDelta, deltaConfianzaEnLaAyuda: "RESET_ZERO" },
    );
    expect(result.confianzaEnLaAyuda).toBe(0);
    expect(result.pisoIntensidadActivo).toBe(true);
  });
});

describe("applyMatrixDelta — boundary values", () => {
  it("clamps confianza minimum at 0 (not 1)", () => {
    const result = applyMatrixDelta(
      { ...BASE, confianzaEnLaAyuda: 1 },
      { ...zeroDelta, deltaConfianzaEnLaAyuda: -3 },
    );
    expect(result.confianzaEnLaAyuda).toBe(0);
  });

  it("rounds to nearest integer", () => {
    const result = applyMatrixDelta(
      { ...BASE, apertura: 5 },
      { ...zeroDelta, deltaApertura: 1 },
    );
    expect(Number.isInteger(result.apertura)).toBe(true);
  });
});
