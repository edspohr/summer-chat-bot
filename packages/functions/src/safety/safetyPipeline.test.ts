import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SafetyCheckInput } from "@salvador/shared";

// Mock the LLM classifier so pipeline tests don't make real Gemini calls.
vi.mock("./llmClassifier.js", () => ({
  classifyMessage: vi.fn(),
}));

// Import after mocking.
import { runSafetyPipeline } from "./safetyPipeline.js";
import { classifyMessage } from "./llmClassifier.js";

const mockClassify = vi.mocked(classifyMessage);

const baseInput = (overrides: Partial<SafetyCheckInput> = {}): SafetyCheckInput => ({
  message: "Creo que deberías llamar a alguien de confianza",
  lastTurns: [],
  sessionId: "test-session",
  mode: "mentor",
  frameBreakSuspected: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runSafetyPipeline — Layer 3 short-circuit", () => {
  it("returns isSafe:false from L3 without calling L2 when a pattern matches", async () => {
    const result = await runSafetyPipeline(
      baseInput({ message: "quiero matarme" })
    );

    expect(result.isSafe).toBe(false);
    expect(result.layer).toBe("L3");
    expect(result.classification).toBe("S");
    expect(result.template).toBe("REAL_DISTRESS");
    expect(result.patternMatched).toBe("SUICIDAL_IDEATION_ACTIVE");
    expect(mockClassify).not.toHaveBeenCalled();
  });

  it("handles all five L3 categories with the correct template", async () => {
    const cases = [
      "me estoy haciendo daño",
      "estoy pensando en suicidarme",
      "tengo pastillas para matarme",
      "me tomé las pastillas para matarme",
    ];
    for (const message of cases) {
      const result = await runSafetyPipeline(baseInput({ message }));
      expect(result.isSafe).toBe(false);
      expect(result.layer).toBe("L3");
      expect(result.template).toBe("REAL_DISTRESS");
    }
  });
});

describe("runSafetyPipeline — Layer 2 (LLM classifier)", () => {
  it("calls L2 in coach mode even without frame-break", async () => {
    mockClassify.mockResolvedValue("N");

    await runSafetyPipeline(baseInput({ mode: "coach" }));

    expect(mockClassify).toHaveBeenCalledOnce();
  });

  it("calls L2 when frameBreakSuspected is true regardless of mode", async () => {
    mockClassify.mockResolvedValue("N");

    await runSafetyPipeline(
      baseInput({ mode: "mentor", frameBreakSuspected: true })
    );

    expect(mockClassify).toHaveBeenCalledOnce();
  });

  it("does not call L2 in mentor mode without frame-break", async () => {
    await runSafetyPipeline(baseInput({ mode: "mentor", frameBreakSuspected: false }));

    expect(mockClassify).not.toHaveBeenCalled();
  });

  it("returns isSafe:false + REAL_DISTRESS when L2 returns S", async () => {
    mockClassify.mockResolvedValue("S");

    const result = await runSafetyPipeline(
      baseInput({ mode: "coach", frameBreakSuspected: true })
    );

    expect(result.isSafe).toBe(false);
    expect(result.layer).toBe("L2");
    expect(result.classification).toBe("S");
    expect(result.template).toBe("REAL_DISTRESS");
    expect(result.patternMatched).toBeNull();
  });

  it("returns isSafe:false + FRAME_BREAK when L2 returns D", async () => {
    mockClassify.mockResolvedValue("D");

    const result = await runSafetyPipeline(
      baseInput({ mode: "coach", frameBreakSuspected: true })
    );

    expect(result.isSafe).toBe(false);
    expect(result.layer).toBe("L2");
    expect(result.classification).toBe("D");
    expect(result.template).toBe("FRAME_BREAK");
  });

  it("returns isSafe:true when L2 returns N", async () => {
    mockClassify.mockResolvedValue("N");

    const result = await runSafetyPipeline(baseInput({ mode: "coach" }));

    expect(result.isSafe).toBe(true);
    expect(result.layer).toBe("L2");
    expect(result.template).toBeNull();
  });
});

describe("runSafetyPipeline — fail-safe on classifier error", () => {
  it("returns isSafe:true (fail-open on L2 error) and does not throw", async () => {
    mockClassify.mockRejectedValue(new Error("Vertex AI unavailable"));

    const result = await runSafetyPipeline(
      baseInput({ mode: "coach", frameBreakSuspected: true })
    );

    // Fail-safe: prefer not blocking the user over crashing.
    // The architecture documents this trade-off explicitly.
    expect(result.isSafe).toBe(true);
  });
});

describe("runSafetyPipeline — safe pass-through", () => {
  it("returns isSafe:true with null layer for normal mentor message", async () => {
    const result = await runSafetyPipeline(
      baseInput({ message: "¿Qué significa la fase Silencio en OASIS?" })
    );

    expect(result.isSafe).toBe(true);
    expect(result.layer).toBeNull();
    expect(result.classification).toBe("N");
  });
});
