import { useState } from "react";
// Phase 0 stub. Full implementation in Phase 6.
export function useSession(_sessionId) {
    const [loading] = useState(false);
    return { session: null, loading };
}
