import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmail, signInWithGoogle, translateAuthError } from "../lib/auth.js";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"email" | "google" | null>(null);

  async function handleEmailLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@") || password.length === 0) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }
    setLoading("email");
    try {
      await signInWithEmail({ email: email.trim(), password });
      navigate("/");
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading("google");
    try {
      await signInWithGoogle();
      navigate("/");
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-warm-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-[1.5rem] bg-summer-blue flex items-center justify-center shadow-md">
            <span className="text-white text-4xl font-title">S</span>
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-title uppercase tracking-wide text-summer-blue">Summer ChatBot</h1>
            <p className="text-sm font-secondary text-stone-500 font-semibold">Fundación Summer</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleEmailLogin(e)} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-xs font-medium text-stone-700">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-medium text-stone-700">
                Contraseña
              </label>
              <Link to="/forgot-password" className="text-xs font-secondary text-summer-blue hover:text-blue-400 font-semibold transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all"
              required
            />
          </div>

          {error !== null && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading !== null}
            className="w-full bg-summer-blue hover:bg-blue-400 text-white rounded-2xl py-3 text-sm font-bold font-secondary tracking-wide shadow-sm disabled:opacity-50 transition-all hover:scale-[1.02]"
          >
            {loading === "email" ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-xs text-stone-400">o</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        <button
          onClick={() => void handleGoogle()}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 rounded-2xl py-3 px-5 text-sm font-secondary font-bold text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all disabled:opacity-50 shadow-sm hover:scale-[1.02]"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading === "google" ? "Iniciando sesión..." : "Continuar con Google"}
        </button>

        <p className="text-[10px] text-stone-400 text-center px-4 leading-tight">
          ¿Problemas con Google? Si estás en WhatsApp o Instagram, abre este link en Safari o Chrome.
        </p>

        <p className="text-center text-sm text-stone-500">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-summer-blue hover:text-blue-400 font-semibold transition-colors">
            Crear cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}
