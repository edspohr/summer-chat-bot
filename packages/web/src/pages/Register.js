import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { USER_PROFILE_ROLE_LABELS, UserProfileRoleSchema, } from "@salvador/shared";
import { signUpWithEmail, translateAuthError } from "../lib/auth.js";
const PROFILE_ROLE_OPTIONS = UserProfileRoleSchema.options;
export default function Register() {
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [profileRole, setProfileRole] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    function validate() {
        if (displayName.trim().length < 2)
            return "Tu nombre debe tener al menos 2 caracteres.";
        if (displayName.trim().length > 50)
            return "Tu nombre es demasiado largo.";
        if (!email.includes("@"))
            return "Ingresa un correo válido.";
        if (password.length < 8)
            return "La contraseña debe tener al menos 8 caracteres.";
        if (password !== confirmPassword)
            return "Las contraseñas no coinciden.";
        if (profileRole === "")
            return "Selecciona tu rol.";
        return null;
    }
    async function handleSubmit(e) {
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
                profileRole: profileRole,
            });
            navigate("/");
        }
        catch (err) {
            setError(translateAuthError(err));
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("main", { className: "min-h-screen flex flex-col items-center justify-center p-6 bg-warm-bg", children: _jsxs("div", { className: "w-full max-w-sm space-y-6", children: [_jsxs("div", { className: "flex flex-col items-center space-y-3", children: [_jsx("div", { className: "w-16 h-16 rounded-[1.5rem] bg-summer-blue flex items-center justify-center shadow-md", children: _jsx("span", { className: "text-white text-4xl font-title", children: "S" }) }), _jsxs("div", { className: "text-center space-y-1", children: [_jsx("h1", { className: "text-2xl font-title uppercase tracking-wide text-summer-blue", children: "Crear cuenta" }), _jsx("p", { className: "text-sm font-secondary text-stone-500 font-semibold", children: "\u00DAnete a Summer ChatBot" })] })] }), _jsxs("form", { onSubmit: (e) => void handleSubmit(e), className: "space-y-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { htmlFor: "name", className: "block text-xs font-medium text-stone-700", children: "Nombre" }), _jsx("input", { id: "name", type: "text", autoComplete: "name", value: displayName, onChange: (e) => setDisplayName(e.target.value), className: "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all", required: true })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { htmlFor: "email", className: "block text-xs font-medium text-stone-700", children: "Correo electr\u00F3nico" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all", required: true })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { htmlFor: "password", className: "block text-xs font-medium text-stone-700", children: "Contrase\u00F1a" }), _jsx("input", { id: "password", type: "password", autoComplete: "new-password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all", required: true }), _jsx("p", { className: "text-xs text-stone-400", children: "M\u00EDnimo 8 caracteres" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { htmlFor: "confirm", className: "block text-xs font-medium text-stone-700", children: "Confirmar contrase\u00F1a" }), _jsx("input", { id: "confirm", type: "password", autoComplete: "new-password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), className: "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all", required: true })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { htmlFor: "role", className: "block text-xs font-medium text-stone-700", children: "\u00BFCu\u00E1l es tu rol?" }), _jsxs("select", { id: "role", value: profileRole, onChange: (e) => setProfileRole(e.target.value), className: "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all", required: true, children: [_jsx("option", { value: "", children: "Selecciona una opci\u00F3n..." }), PROFILE_ROLE_OPTIONS.map((r) => (_jsx("option", { value: r, children: USER_PROFILE_ROLE_LABELS[r] }, r)))] })] }), error !== null && (_jsx("p", { className: "text-sm text-red-500 text-center", children: error })), _jsx("button", { type: "submit", disabled: loading, className: "w-full bg-summer-blue hover:bg-blue-400 text-white rounded-2xl py-3 text-sm font-bold font-secondary tracking-wide shadow-sm disabled:opacity-50 transition-all hover:scale-[1.02]", children: loading ? "Creando cuenta..." : "Crear cuenta" })] }), _jsxs("p", { className: "text-center text-sm text-stone-500", children: ["\u00BFYa tienes cuenta?", " ", _jsx(Link, { to: "/login", className: "text-summer-blue hover:text-blue-400 font-semibold transition-colors", children: "Iniciar sesi\u00F3n" })] })] }) }));
}
