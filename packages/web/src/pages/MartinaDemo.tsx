import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { signInAnon } from "../lib/auth.js";

const MARTINA_SCENARIO_ID = "scenario_03_martina";

export default function MartinaDemo() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const didAttempt = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (user !== null) {
      const sessionId = crypto.randomUUID();
      navigate(`/session/${sessionId}?scenarioId=${MARTINA_SCENARIO_ID}`, { replace: true });
      return;
    }

    if (didAttempt.current) return;
    didAttempt.current = true;

    signInAnon().catch(() => {
      // If anon sign-in fails (e.g. provider not enabled), fall back to login
      navigate("/login", { replace: true });
    });
  }, [user, loading, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-warm-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-summer-blue flex items-center justify-center shadow-md">
          <span className="text-white text-2xl font-title">S</span>
        </div>
        <p className="text-stone-400 text-sm font-secondary">Preparando sesión...</p>
      </div>
    </main>
  );
}
