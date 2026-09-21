// Pure ownership + state gate for coachTurn. Kept dependency-free (no Firestore
// import) so tests can exercise it without pulling `config/firebase.ts` — that
// import is what hangs vitest per debt-0021.
//
// The check runs after `createSession` in coachHandler, at which point the
// session doc is guaranteed to exist (createSession is idempotent). The gate:
//   - Different `userId` on the doc → cross-account access; deny.
//   - Terminal states (closed_inactivity, closed_completed) → do not process
//     any more turns; the client already knows to show the closing screen.
//   - crisis_interrupted → do not process turns; the client must call
//     resumeAfterCrisis first (explicit confirmation).
//   - anything else (active, or unset/legacy) → proceed.

export interface SessionDocSlice {
  userId?: string | null;
  state?: string | null;
}

export type SessionAccessResult =
  | { kind: "ok" }
  | { kind: "wrong-owner" }
  | { kind: "closed"; state: "closed_inactivity" | "closed_completed" }
  | { kind: "crisis-interrupted" };

export function checkSessionAccess(
  data: SessionDocSlice | null,
  requestUserId: string
): SessionAccessResult {
  // If the doc genuinely does not exist (createSession would have created it,
  // but paranoia is cheap here), treat as ok — createSession will run again
  // on the next turn if needed. The caller has already guaranteed existence.
  if (data === null) return { kind: "ok" };

  if (typeof data.userId === "string" && data.userId !== requestUserId) {
    return { kind: "wrong-owner" };
  }

  switch (data.state) {
    case "closed_inactivity":
      return { kind: "closed", state: "closed_inactivity" };
    case "closed_completed":
      return { kind: "closed", state: "closed_completed" };
    case "crisis_interrupted":
      return { kind: "crisis-interrupted" };
    default:
      // active, undefined, or any legacy/unknown state → proceed. If we don't
      // recognize it, we err on the side of letting the trainee keep talking;
      // safety pipeline still runs first on every processed turn.
      return { kind: "ok" };
  }
}
