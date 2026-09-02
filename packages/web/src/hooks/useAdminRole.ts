import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "./useAuth.js";

export type AdminRoleStatus =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; isAdmin: boolean }
  | { status: "error" };

// Reads the `role` field on users/{uid}. `role === "admin"` gates team-only
// surfaces (LabChat guard, Landing team cards). Non-admin, anonymous, and
// error states all resolve as non-privileged — callers decide whether to
// redirect (LabChat) or degrade UI (Landing).
export function useAdminRole(): AdminRoleStatus {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AdminRoleStatus>({ status: "loading" });

  useEffect(() => {
    if (authLoading) {
      setState({ status: "loading" });
      return;
    }
    if (user === null) {
      setState({ status: "anonymous" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (cancelled) return;
        const role = (snap.data() as { role?: string } | undefined)?.role;
        setState({ status: "authenticated", isAdmin: role === "admin" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
