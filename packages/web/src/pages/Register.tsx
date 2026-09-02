import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  USER_PROFILE_ROLE_LABELS,
  UserProfileRoleSchema,
  type UserProfileRole,
} from "@salvador/shared";
import { signUpWithEmail, translateAuthError } from "../lib/auth.js";
import { AppIcon } from "../components/AppIcon.js";

const PROFILE_ROLE_OPTIONS = UserProfileRoleSchema.options;

export default function Register() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileRole, setProfileRole] = useState<UserProfileRole | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (displayName.trim().length < 2) return "Tu nombre debe tener al menos 2 caracteres.";
    if (displayName.trim().length > 50) return "Tu nombre es demasiado largo.";
    if (!email.includes("@")) return "Ingresa un correo válido.";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (password !== confirmPassword) return "Las contraseñas no coinciden.";
    if (profileRole === "") return "Selecciona tu rol.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        profileRole: profileRole as UserProfileRole,
      });
      navigate("/inicio");
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
            <h1 className="text-2xl font-title uppercase tracking-wide text-summer-blue">Crear cuenta</h1>
            <p className="text-sm font-secondary text-stone-500 font-semibold">Únete a Summer ChatBot</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="name" className="block text-xs font-medium text-stone-700">
              Nombre
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all"
              required
            />
          </div>

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
            <label htmlFor="password" className="block text-xs font-medium text-stone-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all"
              required
            />
            <p className="text-xs text-stone-400">Mínimo 8 caracteres</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm" className="block text-xs font-medium text-stone-700">
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="role" className="block text-xs font-medium text-stone-700">
              ¿Cuál es tu rol?
            </label>
            <select
              id="role"
              value={profileRole}
              onChange={(e) => setProfileRole(e.target.value as UserProfileRole | "")}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all"
              required
            >
              <option value="">Selecciona una opción...</option>
              {PROFILE_ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {USER_PROFILE_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {error !== null && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-summer-blue hover:bg-blue-400 text-white rounded-2xl py-3 text-sm font-bold font-secondary tracking-wide shadow-sm disabled:opacity-50 transition-all hover:scale-[1.02]"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-summer-blue hover:text-blue-400 font-semibold transition-colors">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
