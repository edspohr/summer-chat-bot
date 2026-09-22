// Pure-function tests. Does NOT import config/firebase.ts (see debt-0021 —
// vitest hangs on any file that transitively imports that module).
import { describe, it, expect } from "vitest";
import { checkSessionAccess } from "./accessCheck.js";

const OWNER = "user-abc";

describe("checkSessionAccess", () => {
  it("returns ok when the requesting user owns the session and it is active", () => {
    expect(checkSessionAccess({ userId: OWNER, state: "active" }, OWNER)).toEqual({
      kind: "ok",
    });
  });

  it("returns ok when state is missing (legacy sessions)", () => {
    expect(checkSessionAccess({ userId: OWNER }, OWNER)).toEqual({ kind: "ok" });
  });

  it("returns ok when the session doc is entirely absent (defensive)", () => {
    expect(checkSessionAccess(null, OWNER)).toEqual({ kind: "ok" });
  });

  it("returns wrong-owner when the doc userId differs from the caller", () => {
    expect(
      checkSessionAccess({ userId: "someone-else", state: "active" }, OWNER)
    ).toEqual({ kind: "wrong-owner" });
  });

  it("returns closed(closed_inactivity) for sessions the scheduler closed", () => {
    expect(
      checkSessionAccess({ userId: OWNER, state: "closed_inactivity" }, OWNER)
    ).toEqual({ kind: "closed", state: "closed_inactivity" });
  });

  it("returns closed(closed_completed) for user-ended sessions", () => {
    expect(
      checkSessionAccess({ userId: OWNER, state: "closed_completed" }, OWNER)
    ).toEqual({ kind: "closed", state: "closed_completed" });
  });

  it("returns crisis-interrupted for sessions awaiting explicit resume", () => {
    expect(
      checkSessionAccess({ userId: OWNER, state: "crisis_interrupted" }, OWNER)
    ).toEqual({ kind: "crisis-interrupted" });
  });

  it("prioritizes wrong-owner over closed state (never leaks a state fact to a stranger)", () => {
    expect(
      checkSessionAccess(
        { userId: "someone-else", state: "closed_inactivity" },
        OWNER
      )
    ).toEqual({ kind: "wrong-owner" });
  });

  it("treats an unknown state string as ok (forward-compat)", () => {
    expect(
      checkSessionAccess({ userId: OWNER, state: "something_new" }, OWNER)
    ).toEqual({ kind: "ok" });
  });
});
