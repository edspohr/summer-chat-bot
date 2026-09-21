// Pure-function tests. Imports only nudgeMessage.ts (no Firestore) so vitest
// does not trigger debt-0021.
import { describe, it, expect } from "vitest";
import {
  buildNudgeMessageArgs,
  NUDGE_CONTENT,
  NUDGE_PROMPT_VERSION,
} from "./nudgeMessage.js";

describe("buildNudgeMessageArgs", () => {
  it("returns an assistant message with meta.isNudge=true", () => {
    const args = buildNudgeMessageArgs("session-abc", 3);
    expect(args.role).toBe("assistant");
    expect(args.meta).toEqual({ isNudge: true });
  });

  it("carries the canonical nudge content and prompt version", () => {
    const args = buildNudgeMessageArgs("session-abc", 0);
    expect(args.content).toBe(NUDGE_CONTENT);
    expect(args.promptVersion).toBe(NUDGE_PROMPT_VERSION);
  });

  it("advances turnNumber to turnCount+1 so the subcollection stays monotonic", () => {
    expect(buildNudgeMessageArgs("s", 0).turnNumber).toBe(1);
    expect(buildNudgeMessageArgs("s", 5).turnNumber).toBe(6);
  });

  it("threads the sessionId through unchanged", () => {
    expect(buildNudgeMessageArgs("session-xyz", 0).sessionId).toBe("session-xyz");
  });
});
