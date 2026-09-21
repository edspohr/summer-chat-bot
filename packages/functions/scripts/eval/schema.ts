// Fixture schema for Fase 2 eval. Kept dependency-free (no Firestore) so it
// runs under vitest without hitting debt-0021.
//
// A fixture is a semi-scripted conversation: trainee lines are fixed, but
// Martina's replies come from Call A live (or from the `dryRunMartina` field
// in --dry-run). Every turn declares its `expected` shape — direction of
// each matrix variable, length bounds, whether frame-break should fire, and
// strings that must NOT appear (OASIS, tag ids, PRODUCT_NAME, evaluation
// jargon).
import { z } from "zod";

export const MatrixDirectionSchema = z.enum(["up", "down", "stable", "reset_zero"]);
export type MatrixDirection = z.infer<typeof MatrixDirectionSchema>;

export const TurnExpectationSchema = z.object({
  matrix: z
    .object({
      intensidadEmocional: MatrixDirectionSchema.optional(),
      apertura: MatrixDirectionSchema.optional(),
      confianzaEnLaAyuda: MatrixDirectionSchema.optional(),
    })
    .default({}),
  martinaMinChars: z.number().int().nonnegative().default(20),
  martinaMaxChars: z.number().int().positive().default(600),
  requiresFrameBreakTag: z.boolean().default(false),
  // The default forbidden list is applied on top per fixture (see checks.ts).
  extraForbiddenStrings: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const FixtureTurnSchema = z.object({
  trainee: z.string().min(1),
  // Reply Martina will "say" in --dry-run. When --live is set, this is
  // ignored and Call A runs against Vertex. Include a plausible-shaped reply
  // so dry-run exercises the checks end-to-end.
  dryRunMartina: z.string().min(1),
  expected: TurnExpectationSchema,
});

export const FixtureSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  scenarioId: z.literal("scenario_03_martina"),
  turns: z.array(FixtureTurnSchema).min(1).max(20),
  notes: z.string(),
});

export type Fixture = z.infer<typeof FixtureSchema>;
export type FixtureTurn = z.infer<typeof FixtureTurnSchema>;
export type TurnExpectation = z.infer<typeof TurnExpectationSchema>;

// Strings that Martina must NEVER say in a normal reply — restricted to
// technical vocabulary that clearly leaks the frame. OASIS phase names
// (Observa / Acoge / Silencio / Ilumina / Sostén) were REMOVED from this
// list on 2026-09-21 after baseline v0: Martina naturally says "silencio"
// and "acoge" in adolescent speech ("me acogió", "hubo un silencio"),
// which produced 6 false-positive FAILs. Case-insensitive substring match.
export const DEFAULT_FORBIDDEN_STRINGS = [
  "OASIS",
  "Summer ChatBot",
  "evaluación",
  "criterio",
  "T_01",
  "T_02",
  "T_03",
  "T_04",
  "T_05",
  "T_06",
  "T_07",
  "T_08",
];
