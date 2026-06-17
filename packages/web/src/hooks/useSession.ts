import { useState } from "react";
import type { Session } from "@salvador/shared";

// Phase 0 stub. Full implementation in Phase 6.
export function useSession(_sessionId: string): {
  session: Session | null;
  loading: boolean;
} {
  const [loading] = useState(false);
  return { session: null, loading };
}
