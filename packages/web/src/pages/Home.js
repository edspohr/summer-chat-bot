import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { logout } from "../lib/auth.js";
function AppIcon({ size = "sm" }) {
    const dim = size === "lg" ? "w-16 h-16 rounded-3xl" : "w-10 h-10 rounded-xl";
    const text = size === "lg" ? "text-3xl" : "text-base";
    return (_jsx("div", { className: `${dim} bg-summer-blue flex items-center justify-center flex-shrink-0 shadow-sm`, children: _jsx("span", { className: `text-white font-title ${text}`, children: "S" }) }));
}
export default function Home() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    useEffect(() => {
        if (!loading && !user)
            navigate("/login");
    }, [user, loading, navigate]);
    async function handleLogout() {
        setLoggingOut(true);
        try {
            await logout();
            navigate("/login");
        }
        catch {
            setLoggingOut(false);
        }
    }
    if (loading) {
        return (_jsx("main", { className: "min-h-screen flex items-center justify-center bg-warm-bg", children: _jsx("p", { className: "text-stone-400 text-sm", children: "Cargando..." }) }));
    }
    const firstName = user?.displayName?.split(" ")[0] ??
        user?.email?.split("@")[0] ??
        "de nuevo";
    return (_jsxs("main", { className: "min-h-screen flex flex-col bg-warm-bg", children: [_jsxs("header", { className: "px-6 py-4 flex items-center justify-between border-b border-summer-blue/20 bg-white shadow-sm relative z-10", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(AppIcon, { size: "sm" }), _jsxs("div", { className: "hidden sm:block", children: [_jsx("span", { className: "font-title uppercase tracking-wide text-summer-blue text-sm block", children: "Summer ChatBot" }), _jsx("span", { className: "font-secondary text-xs text-stone-500 font-semibold", children: "Convi\u00E9rtete en un OASIS." })] }), _jsx("div", { className: "sm:hidden", children: _jsx("span", { className: "font-title uppercase tracking-wide text-summer-blue text-sm", children: "Summer ChatBot" }) })] }), _jsxs("button", { onClick: () => setMenuOpen((v) => !v), className: "text-sm font-secondary font-semibold text-stone-500 hover:text-summer-blue truncate max-w-[180px] flex items-center gap-1 transition-colors", children: [_jsx("span", { className: "truncate", children: user?.email ?? user?.displayName }), _jsx("span", { className: "text-stone-300", children: "\u25BE" })] }), menuOpen && (_jsx("div", { className: "absolute right-6 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-md py-1 min-w-[140px] z-10", children: _jsx("button", { onClick: () => void handleLogout(), disabled: loggingOut, className: "w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50", children: loggingOut ? "Cerrando..." : "Cerrar sesión" }) }))] }), _jsx("div", { className: "flex-1 flex flex-col items-center justify-center px-6 py-10", children: _jsxs("div", { className: "w-full max-w-sm space-y-8", children: [_jsxs("div", { className: "space-y-2 text-center sm:text-left", children: [_jsxs("h1", { className: "font-title uppercase tracking-wider text-2xl text-stone-800", children: ["Hola, ", firstName] }), _jsx("p", { className: "font-secondary text-sm text-stone-600", children: "\u00BFQu\u00E9 quieres practicar hoy? Te invitamos a explorar nuestras simulaciones y herramientas de mentor\u00EDa." })] }), _jsxs("div", { className: "space-y-4", children: [_jsx(Link, { to: "/scenarios", className: "block w-full bg-summer-blue hover:bg-blue-400 text-white rounded-3xl py-6 px-6 transition-all shadow-md hover:scale-[1.02] hover:shadow-lg group", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-title uppercase tracking-wide text-xl", children: "Modo Coach" }), _jsx("p", { className: "font-secondary text-sm text-white/90 mt-1", children: "Practica la metodolog\u00EDa OASIS con un personaje simulado interactivo" })] }), _jsx("span", { className: "text-white/50 text-2xl ml-4 group-hover:text-white transition-colors", children: "\u2192" })] }) }), _jsx(Link, { to: "/mentor", className: "block w-full bg-white border-2 border-summer-teal/30 hover:border-summer-teal hover:bg-summer-teal/5 text-stone-800 rounded-3xl py-6 px-6 transition-all shadow-sm hover:shadow-md group", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-title uppercase tracking-wide text-xl text-summer-teal", children: "Modo Mentor" }), _jsx("p", { className: "font-secondary text-sm text-stone-500 mt-1", children: "Consulta conceptos y refuerza la metodolog\u00EDa OASIS" })] }), _jsx("span", { className: "text-summer-teal/50 text-2xl ml-4 group-hover:text-summer-teal transition-colors", children: "\u2192" })] }) })] }), _jsx("p", { className: "text-center text-xs text-stone-400", children: "Fundaci\u00F3n Summer \u00B7 Primeros Auxilios Emocionales" })] }) })] }));
}
