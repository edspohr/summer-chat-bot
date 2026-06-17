import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { logout } from "../lib/auth.js";

function AppIcon({ size = "sm" }: { size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-16 h-16 rounded-3xl" : "w-10 h-10 rounded-xl";
  const text = size === "lg" ? "text-3xl" : "text-base";
  return (
    <div className={`${dim} bg-summer-blue flex items-center justify-center flex-shrink-0 shadow-sm`}>
      <span className={`text-white font-title ${text}`}>S</span>
    </div>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-warm-bg">
        <p className="text-stone-400 text-sm">Cargando...</p>
      </main>
    );
  }

  const firstName =
    user?.displayName?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "de nuevo";

  return (
    <main className="min-h-screen flex flex-col bg-warm-bg">
      <header className="px-6 py-4 flex items-center justify-between border-b border-summer-blue/20 bg-white shadow-sm relative z-10">
        <div className="flex items-center gap-3">
          <AppIcon size="sm" />
          <div className="hidden sm:block">
            <span className="font-title uppercase tracking-wide text-summer-blue text-sm block">Summer ChatBot</span>
            <span className="font-secondary text-xs text-stone-500 font-semibold">Conviértete en un OASIS.</span>
          </div>
          <div className="sm:hidden">
            <span className="font-title uppercase tracking-wide text-summer-blue text-sm">Summer ChatBot</span>
          </div>
        </div>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="text-sm font-secondary font-semibold text-stone-500 hover:text-summer-blue truncate max-w-[180px] flex items-center gap-1 transition-colors"
        >
          <span className="truncate">{user?.email ?? user?.displayName}</span>
          <span className="text-stone-300">▾</span>
        </button>
        {menuOpen && (
          <div className="absolute right-6 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-md py-1 min-w-[140px] z-10">
            <button
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {loggingOut ? "Cerrando..." : "Cerrar sesión"}
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center sm:text-left">
            <h1 className="font-title uppercase tracking-wider text-2xl text-stone-800">
              Hola, {firstName}
            </h1>
            <p className="font-secondary text-sm text-stone-600">
              ¿Qué quieres practicar hoy? Te invitamos a explorar nuestras simulaciones y herramientas de mentoría.
            </p>
          </div>

          <div className="space-y-4">
            <Link
              to="/scenarios"
              className="block w-full bg-summer-blue hover:bg-blue-400 text-white rounded-3xl py-6 px-6 transition-all shadow-md hover:scale-[1.02] hover:shadow-lg group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-title uppercase tracking-wide text-xl">Modo Coach</p>
                  <p className="font-secondary text-sm text-white/90 mt-1">
                    Practica la metodología OASIS con un personaje simulado interactivo
                  </p>
                </div>
                <span className="text-white/50 text-2xl ml-4 group-hover:text-white transition-colors">→</span>
              </div>
            </Link>

            <Link
              to="/mentor"
              className="block w-full bg-white border-2 border-summer-teal/30 hover:border-summer-teal hover:bg-summer-teal/5 text-stone-800 rounded-3xl py-6 px-6 transition-all shadow-sm hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-title uppercase tracking-wide text-xl text-summer-teal">Modo Mentor</p>
                  <p className="font-secondary text-sm text-stone-500 mt-1">
                    Consulta conceptos y refuerza la metodología OASIS
                  </p>
                </div>
                <span className="text-summer-teal/50 text-2xl ml-4 group-hover:text-summer-teal transition-colors">→</span>
              </div>
            </Link>
          </div>

          <p className="text-center text-xs text-stone-400">
            Fundación Summer · Primeros Auxilios Emocionales
          </p>
        </div>
      </div>
    </main>
  );
}
