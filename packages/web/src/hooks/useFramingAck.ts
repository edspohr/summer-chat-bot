import { useCallback, useState } from "react";

const STORAGE_KEY = "summer:framingAck:v1";

function readAck(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private mode / storage disabled — fall back to unacked (modal will show
    // once per page load, which is acceptable and safer than skipping it).
    return false;
  }
}

export interface FramingAckHookResult {
  acknowledged: boolean;
  acknowledge: () => void;
}

// One-shot per browser session. Persisted in sessionStorage so a reload of
// the same session does not re-show the modal, but a new tab does.
export function useFramingAck(): FramingAckHookResult {
  const [acknowledged, setAcknowledged] = useState<boolean>(readAck);

  const acknowledge = useCallback(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore — we still flip the in-memory flag so the current session works.
    }
    setAcknowledged(true);
  }, []);

  return { acknowledged, acknowledge };
}
