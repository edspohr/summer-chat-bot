// Pure-function tests for the formative report generator's core. Zero
// Firestore imports.
import { describe, it, expect } from "vitest";
import type { MessageSlice, SessionSlice, TurnoSlice } from "./reportGeneratorCore.js";
import {
  gateSession,
  computeSessionFacts,
  sanitizeConversation,
  formatConversationForPrompt,
  formatTurnEvaluations,
  normalizeForQuoteMatch,
  verifyQuote,
  verifyMoment,
  postProcessReport,
  shouldWaitForLastTurno,
} from "./reportGeneratorCore.js";

const OWNER = "u1";
const OPTS = { now: 10_000_000, staleMs: 90_000, maxAttempts: 2, minUserTurns: 3 };

function baseSession(overrides: Partial<SessionSlice> = {}): SessionSlice {
  return {
    userId: OWNER,
    state: "closed_completed",
    endedReason: "user_ended",
    sesionIniciadaEnIso: null,
    endedAtIso: null,
    resumedAtIso: null,
    estadoMatriz: null,
    currentAttempts: 0,
    existingStatus: null,
    existingGeneratedAtIso: null,
    ...overrides,
  };
}

function u(content: string, turn: number, extra: Partial<MessageSlice> = {}): MessageSlice {
  return { role: "user", content, turnNumber: turn, ...extra };
}
function a(content: string, turn: number, extra: Partial<MessageSlice> = {}): MessageSlice {
  return { role: "assistant", content, turnNumber: turn, ...extra };
}

// ── gateSession ───────────────────────────────────────────────────────────

describe("gateSession", () => {
  it("returns already_ready when a report is already ready", () => {
    const r = gateSession(
      baseSession({ existingStatus: "ready" }),
      [u("a", 1), u("b", 3), u("c", 5)],
      OPTS,
    );
    expect(r).toEqual({ kind: "already_ready" });
  });

  it("returns generating_fresh when a recent generation is in flight", () => {
    const started = new Date(OPTS.now - 5_000).toISOString();
    const r = gateSession(
      baseSession({ existingStatus: "generating", existingGeneratedAtIso: started }),
      [u("a", 1), u("b", 3), u("c", 5)],
      OPTS,
    );
    expect(r.kind).toBe("generating_fresh");
  });

  it("returns generating_stale when the previous generation is older than staleMs", () => {
    const started = new Date(OPTS.now - 200_000).toISOString();
    const r = gateSession(
      baseSession({ existingStatus: "generating", existingGeneratedAtIso: started }),
      [u("a", 1), u("b", 3), u("c", 5)],
      OPTS,
    );
    expect(r.kind).toBe("generating_stale");
  });

  it("failed → can_retry until maxAttempts", () => {
    const r1 = gateSession(
      baseSession({ existingStatus: "failed", currentAttempts: 1 }),
      [u("a", 1), u("b", 3), u("c", 5)],
      OPTS,
    );
    expect(r1.kind).toBe("failed_can_retry");
    const r2 = gateSession(
      baseSession({ existingStatus: "failed", currentAttempts: 2 }),
      [u("a", 1), u("b", 3), u("c", 5)],
      OPTS,
    );
    expect(r2.kind).toBe("failed_exhausted");
  });

  it("skips crisis_interrupted with no prior report", () => {
    const r = gateSession(
      baseSession({ state: "crisis_interrupted" }),
      [u("a", 1), u("b", 3), u("c", 5)],
      OPTS,
    );
    expect(r.kind).toBe("skip_crisis_interrupted");
  });

  it("skips too_short with fewer than 3 user turns", () => {
    const r = gateSession(baseSession(), [u("a", 1), u("b", 3)], OPTS);
    expect(r).toEqual({ kind: "skip_too_short", userTurnCount: 2 });
  });

  it("proceeds with >= 3 user turns and an active endedReason", () => {
    const r = gateSession(baseSession(), [u("a", 1), u("b", 3), u("c", 5)], OPTS);
    expect(r).toEqual({ kind: "proceed", userTurnCount: 3 });
  });
});

// ── computeSessionFacts ───────────────────────────────────────────────────

describe("computeSessionFacts", () => {
  it("counts user turns and derives duration from ISO timestamps", () => {
    const f = computeSessionFacts(
      baseSession({
        sesionIniciadaEnIso: "2026-09-21T10:00:00Z",
        endedAtIso: "2026-09-21T10:06:30Z",
      }),
      [u("a", 1), a("m", 2), u("b", 3), u("c", 5)],
    );
    expect(f.userTurnCount).toBe(3);
    expect(f.durationMinutes).toBe(7); // 6.5 rounded
    expect(f.wasResumedAfterCrisis).toBe(false);
  });

  it("wasResumedAfterCrisis flips when resumedAt is set", () => {
    const f = computeSessionFacts(
      baseSession({ resumedAtIso: "2026-09-21T10:03:00Z" }),
      [u("a", 1)],
    );
    expect(f.wasResumedAfterCrisis).toBe(true);
  });
});

// ── sanitizeConversation ─────────────────────────────────────────────────

describe("sanitizeConversation", () => {
  it("drops a Layer 3 user turn + the paired assistant template + nudges", () => {
    const messages: MessageSlice[] = [
      a("Hola profe", 0),
      u("me quiero morir", 1, { safetyLayerTriggered: "L3" }),
      a("Salvador es una herramienta... [template]", 2),
      u("¿profe sigue ahí?", 3),   // this happens to be a user turn labeled after nudge — kept
      a("¿Profe, sigue ahí?", 4, { meta: { isNudge: true } }),
      u("perdón, sigo aquí", 5),
      a("qué bueno...", 6),
    ];
    const s = sanitizeConversation(messages);
    // Excluded indices: 1 (safety trigger), 2 (safety template), 4 (nudge)
    expect(s.excludedIndices).toEqual([1, 2, 4]);
    expect(s.messages.map((m) => m.content)).toEqual([
      "Hola profe",
      "¿profe sigue ahí?",
      "perdón, sigo aquí",
      "qué bueno...",
    ]);
    expect(s.excludedReasons[1]).toBe("safety_trigger");
    expect(s.excludedReasons[2]).toBe("safety_template");
    expect(s.excludedReasons[4]).toBe("nudge");
  });

  it("keeps everything when there is no safety event or nudge", () => {
    const messages: MessageSlice[] = [u("a", 1), a("b", 2), u("c", 3)];
    const s = sanitizeConversation(messages);
    expect(s.excludedIndices).toEqual([]);
    expect(s.messages).toHaveLength(3);
  });
});

// ── formatConversationForPrompt / formatTurnEvaluations ──────────────────

describe("formatting", () => {
  it("renders conversation as Aprendiz/Martina blocks separated by blank lines", () => {
    const out = formatConversationForPrompt([u("hola", 1), a("hola profe", 2)]);
    expect(out).toContain("Aprendiz: hola");
    expect(out).toContain("Martina: hola profe");
    expect(out.split("\n\n")).toHaveLength(2);
  });

  it("turn evaluations block enumerates trainee turns only", () => {
    const turnos: TurnoSlice[] = [
      {
        turnoId: "1", rol: "usuario", contenido: "hola",
        deltas: { intensidadEmocional: -1, apertura: 1, confianzaEnLaAyuda: 0 },
        tagsObservados: ["T_02_OBSERVA_NO_JUICIO_S03"],
        antiPatronesDetectados: [],
      },
      {
        turnoId: "2", rol: "martina", contenido: "ehh",
        deltas: { intensidadEmocional: 0, apertura: 0, confianzaEnLaAyuda: 0 },
        tagsObservados: [],
        antiPatronesDetectados: [],
      },
    ];
    const out = formatTurnEvaluations(turnos);
    expect(out).toContain("Turno 1");
    expect(out).toContain("T_02_OBSERVA_NO_JUICIO_S03");
    expect(out).not.toContain("Turno 2"); // martina turns excluded
  });
});

// ── Quote verification ──────────────────────────────────────────────────

describe("normalizeForQuoteMatch", () => {
  it("folds smart quotes and dashes and lowercases", () => {
    expect(normalizeForQuoteMatch("¿Cómo “estás”?"))
      .toBe('¿cómo "estás"?');
    expect(normalizeForQuoteMatch("Sí — igual")).toBe("sí - igual");
  });
  it("collapses whitespace but preserves accents", () => {
    expect(normalizeForQuoteMatch("hola   PROFE\n\nMartina")).toBe("hola profe martina");
  });
});

describe("verifyQuote", () => {
  const corpus: MessageSlice[] = [
    u("Martina, me quedé pensando en ti después de la clase.", 1),
    u("Cuéntame qué te pasó anoche", 3),
  ];
  it("accepts a verbatim substring", () => {
    expect(verifyQuote("me quedé pensando en ti", corpus)).toBe(true);
  });
  it("accepts a substring that differs only by smart quotes and whitespace", () => {
    expect(verifyQuote("me   quedé pensando en ti", corpus)).toBe(true);
  });
  it("rejects a paraphrase", () => {
    expect(verifyQuote("estuve pensando en ti", corpus)).toBe(false);
  });
});

// ── verifyMoment ─────────────────────────────────────────────────────────

describe("verifyMoment", () => {
  const userMsgs: MessageSlice[] = [u("Martina, quiero saber cómo estás", 1)];
  const assistantMsgs: MessageSlice[] = [a("Hola profe... no sé", 2)];

  it("drops the moment when the quote is not verbatim", () => {
    const m = { quote: "no exacto", whatHappenedWithMartina: "algo" as string };
    expect(verifyMoment(m, userMsgs, assistantMsgs)).toBeNull();
  });

  it("keeps the moment when quote matches; keeps martinaCue when it verifies", () => {
    const m = {
      quote: "quiero saber cómo estás",
      martinaCue: "no sé",
      whatHappenedWithMartina: "algo pasó suficientemente largo",
    };
    const v = verifyMoment(m, userMsgs, assistantMsgs);
    expect(v).not.toBeNull();
    expect(v!.moment.martinaCue).toBe("no sé");
    expect(v!.droppedMartinaCue).toBe(false);
  });

  it("keeps the moment but drops martinaCue when only the cue fails", () => {
    const m = {
      quote: "quiero saber cómo estás",
      martinaCue: "cita inventada",
      whatHappenedWithMartina: "algo pasó suficientemente largo",
    };
    const v = verifyMoment(m, userMsgs, assistantMsgs);
    expect(v).not.toBeNull();
    expect(v!.moment.martinaCue).toBeUndefined();
    expect(v!.droppedMartinaCue).toBe(true);
  });
});

// ── postProcessReport ────────────────────────────────────────────────────

describe("postProcessReport", () => {
  const userMsgs: MessageSlice[] = [
    u("Martina, cuéntame cómo estás hoy", 1),
    u("¿en algún momento has pensado en hacerte daño?", 3),
    u("Me quedo contigo. ¿Con quién sientes confianza?", 5),
  ];
  const assistantMsgs: MessageSlice[] = [
    a("emm... no sé profe", 2),
    a("uf... a veces", 4),
    a("el tata igual", 6),
  ];
  const messages = [
    ...userMsgs.map((m, i) => ({ ...m, turnNumber: i * 2 + 1 })),
    ...assistantMsgs,
  ];

  it("returns ok content when >=2 moments verify", () => {
    const raw = {
      synthesis: "Una conversación en la que abriste un espacio y Martina se atrevió a hablar un poco más de sí misma.",
      keyMoments: [
        { quote: "cuéntame cómo estás hoy", oasisPhase: "OBSERVA", whatHappenedWithMartina: "Martina soltó una respuesta corta pero abierta." },
        { quote: "pensado en hacerte daño", oasisPhase: "ACOGE", whatHappenedWithMartina: "Ella tomó un respiro y compartió algo importante." },
      ],
      strengthToKeep: "Sostuviste la calma y no llenaste los silencios.",
      focusForNextAttempt: "Explora un poco más los recursos de red que ella misma mencione.",
      reflectionPrompts: [
        "¿qué notaste en ti mientras esperabas su respuesta?",
        "¿qué recurso propio te gustaría tener a mano para la próxima?",
      ],
    };
    const r = postProcessReport(raw, messages);
    expect(r.ok).toBe(true);
    expect(r.content!.keyMoments).toHaveLength(2);
  });

  it("marks moments_unverifiable when <2 moments survive", () => {
    const raw = {
      synthesis: "una conversación breve y todavía tentativa entre ustedes dos",
      keyMoments: [
        { quote: "esto lo inventé", oasisPhase: "OBSERVA", whatHappenedWithMartina: "algo con largo suficiente para pasar la validación" },
        { quote: "esto tampoco existe", oasisPhase: "ACOGE", whatHappenedWithMartina: "algo con largo suficiente para pasar la validación" },
      ],
      strengthToKeep: "algo con largo suficiente para pasar la validación",
      focusForNextAttempt: "algo con largo suficiente para pasar la validación",
      reflectionPrompts: ["primera pregunta abierta", "segunda pregunta abierta"],
    };
    const r = postProcessReport(raw, messages);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("moments_unverifiable");
    expect(r.droppedMoments).toBe(2);
  });

  it("marks schema_invalid on garbage input", () => {
    const r = postProcessReport({ nope: true }, messages);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("schema_invalid");
  });
});

describe("shouldWaitForLastTurno", () => {
  it("waits only when exactly one turno is missing", () => {
    expect(shouldWaitForLastTurno({ userTurnCount: 5, usuarioTurnoCount: 4 })).toBe(true);
    expect(shouldWaitForLastTurno({ userTurnCount: 5, usuarioTurnoCount: 5 })).toBe(false);
    expect(shouldWaitForLastTurno({ userTurnCount: 5, usuarioTurnoCount: 3 })).toBe(false);
  });
});
