import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset, translateAuthError } from "../lib/auth.js";
import { AppIcon } from "../components/AppIcon.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Ingresa un correo válido.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-warm-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-3">
          <AppIcon size="lg" />
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-title uppercase tracking-wide text-summer-blue">Recuperar contraseña</h1>
            <p className="text-sm font-secondary text-stone-500 font-semibold">
              Te enviaremos un enlace para restablecerla
            </p>
          </div>
        </div>

        {sent ? (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2">
            <p className="text-sm text-teal-800 font-medium">Enlace enviado</p>
            <p className="text-xs text-teal-700">
              Revisa tu correo. Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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

            {error !== null && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-summer-blue hover:bg-blue-400 text-white rounded-2xl py-3 text-sm font-bold font-secondary tracking-wide shadow-sm disabled:opacity-50 transition-all hover:scale-[1.02]"
            >
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}

        <p className="text-center text-sm">
          <Link to="/login" className="text-summer-blue hover:text-blue-400 font-semibold transition-colors">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
