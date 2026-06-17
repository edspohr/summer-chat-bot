import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";
import { ScenarioSchema } from "@salvador/shared";
import { useAuth } from "../hooks/useAuth.js";
export default function ScenarioSelect() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [scenarios, setScenarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!authLoading && !user)
            navigate("/login");
    }, [user, authLoading, navigate]);
    useEffect(() => {
        if (!user)
            return;
        const q = query(collection(db, "scenarios"), where("active", "==", true));
        getDocs(q)
            .then((snap) => {
            const list = [];
            for (const d of snap.docs) {
                const parsed = ScenarioSchema.safeParse({ id: d.id, ...d.data() });
                if (parsed.success)
                    list.push(parsed.data);
            }
            setScenarios(list);
        })
            .catch(() => setError("Error al cargar los escenarios"))
            .finally(() => setLoading(false));
    }, [user]);
    function startSession(scenarioId) {
        const sessionId = crypto.randomUUID();
        navigate(`/session/${sessionId}?scenarioId=${scenarioId}`);
    }
    if (loading || authLoading) {
        return (_jsx("main", { className: "min-h-screen flex items-center justify-center bg-warm-bg", children: _jsx("p", { className: "text-stone-400 text-sm", children: "Cargando escenarios..." }) }));
    }
    return (_jsxs("main", { className: "min-h-screen flex flex-col bg-warm-bg", children: [_jsxs("header", { className: "px-4 py-4 border-b border-stone-100 bg-white flex items-center gap-3 shadow-sm", children: [_jsx("button", { onClick: () => navigate("/"), className: "text-stone-400 hover:text-summer-blue text-xl px-1 transition-colors", children: "\u2190" }), _jsxs("div", { children: [_jsx("h1", { className: "font-title uppercase tracking-wider text-summer-blue text-xl", children: "Modo Coach" }), _jsx("p", { className: "font-secondary text-xs text-stone-500", children: "Elige un escenario de simulaci\u00F3n" })] })] }), _jsxs("div", { className: "flex-1 px-8 py-10 max-w-7xl mx-auto w-full", children: [error !== null && (_jsx("p", { className: "text-sm text-red-500 text-center", children: error })), scenarios.length === 0 && error === null && (_jsx("div", { className: "text-center py-12 space-y-2", children: _jsx("p", { className: "text-stone-400 text-sm", children: "No hay escenarios disponibles en este momento." }) })), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8", children: scenarios.map((s) => (_jsxs("button", { onClick: () => startSession(s.id), className: "group flex flex-col bg-white border border-stone-100 hover:border-summer-teal hover:shadow-xl rounded-[2.5rem] overflow-hidden transition-all duration-300 text-left", children: [_jsxs("div", { className: "aspect-[4/3] w-full overflow-hidden bg-summer-pink/10 relative", children: [s.persona.avatarUrl ? (_jsx("img", { src: s.persona.avatarUrl, alt: s.persona.name, className: "w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" })) : (_jsx("div", { className: "w-full h-full flex items-center justify-center text-summer-pink font-title text-7xl", children: s.persona.name.charAt(0) })), _jsx("div", { className: "absolute top-6 right-6 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm group-hover:bg-summer-teal group-hover:text-white transition-all", children: _jsx("span", { className: "text-xl", children: "\u2192" }) })] }), _jsxs("div", { className: "p-8 flex-1 flex flex-col space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-title uppercase tracking-wider text-stone-800 text-2xl group-hover:text-summer-teal transition-colors", children: s.persona.name }), _jsxs("p", { className: "font-secondary text-xs text-stone-400 font-bold uppercase tracking-widest mt-1", children: [s.persona.age, " a\u00F1os \u00B7 ", s.persona.role] })] }), _jsx("p", { className: "font-secondary text-sm text-stone-600 leading-relaxed line-clamp-3", children: s.description }), _jsx("div", { className: "pt-2 mt-auto", children: _jsxs("div", { className: "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-summer-teal/10 text-summer-teal font-secondary text-xs font-bold uppercase tracking-tighter", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-summer-teal animate-pulse" }), s.requiredTags.length, " competencias"] }) })] })] }, s.id))) })] })] }));
}
