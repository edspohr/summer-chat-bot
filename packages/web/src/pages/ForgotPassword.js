import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset, translateAuthError } from "../lib/auth.js";
export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState(null);
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    async function handleSubmit(e) {
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
        }
        catch (err) {
            setError(translateAuthError(err));
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("main", { className: "min-h-screen flex flex-col items-center justify-center p-6 bg-warm-bg", children: _jsxs("div", { className: "w-full max-w-sm space-y-6", children: [_jsxs("div", { className: "flex flex-col items-center space-y-3", children: [_jsx("div", { className: "w-16 h-16 rounded-[1.5rem] bg-summer-blue flex items-center justify-center shadow-md", children: _jsx("span", { className: "text-white text-4xl font-title", children: "S" }) }), _jsxs("div", { className: "text-center space-y-1", children: [_jsx("h1", { className: "text-2xl font-title uppercase tracking-wide text-summer-blue", children: "Recuperar contrase\u00F1a" }), _jsx("p", { className: "text-sm font-secondary text-stone-500 font-semibold", children: "Te enviaremos un enlace para restablecerla" })] })] }), sent ? (_jsxs("div", { className: "bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2", children: [_jsx("p", { className: "text-sm text-teal-800 font-medium", children: "Enlace enviado" }), _jsx("p", { className: "text-xs text-teal-700", children: "Revisa tu correo. Si el correo est\u00E1 registrado, recibir\u00E1s un enlace para restablecer tu contrase\u00F1a." })] })) : (_jsxs("form", { onSubmit: (e) => void handleSubmit(e), className: "space-y-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { htmlFor: "email", className: "block text-xs font-medium text-stone-700", children: "Correo electr\u00F3nico" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 focus:ring-summer-blue/50 transition-all", required: true })] }), error !== null && (_jsx("p", { className: "text-sm text-red-500 text-center", children: error })), _jsx("button", { type: "submit", disabled: loading, className: "w-full bg-summer-blue hover:bg-blue-400 text-white rounded-2xl py-3 text-sm font-bold font-secondary tracking-wide shadow-sm disabled:opacity-50 transition-all hover:scale-[1.02]", children: loading ? "Enviando..." : "Enviar enlace" })] })), _jsx("p", { className: "text-center text-sm", children: _jsx(Link, { to: "/login", className: "text-summer-blue hover:text-blue-400 font-semibold transition-colors", children: "Volver al inicio de sesi\u00F3n" }) })] }) }));
}
