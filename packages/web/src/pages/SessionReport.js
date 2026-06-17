import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useScenario } from "../hooks/useScenario.js";
import { useTagProgress } from "../hooks/useTagProgress.js";
import { useEffect } from "react";
export default function SessionReport() {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const scenarioId = searchParams.get("scenarioId") ?? "";
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { scenario, loading: scenarioLoading } = useScenario(scenarioId);
    const tagProgressItems = useTagProgress(sessionId ?? "");
    useEffect(() => {
        if (!authLoading && !user)
            navigate("/login");
    }, [user, authLoading, navigate]);
    if (authLoading || scenarioLoading || !scenario) {
        return (_jsx("main", { className: "min-h-screen flex items-center justify-center bg-warm-bg", children: _jsx("p", { className: "text-stone-400 text-sm", children: "Generando reporte..." }) }));
    }
    const completedTagIds = new Set(tagProgressItems.filter(t => t.completed).map(t => t.tagId));
    const expectedTags = scenario.requiredTags?.map(t => t.tagId) || [];
    const matchedTags = expectedTags.filter(tagId => completedTagIds.has(tagId));
    const missingTags = expectedTags.filter(tagId => !completedTagIds.has(tagId));
    const matchingLevel = expectedTags.length > 0
        ? Math.round((matchedTags.length / expectedTags.length) * 100)
        : 0;
    return (_jsx("main", { className: "min-h-screen flex flex-col bg-warm-bg py-8 px-4", children: _jsxs("div", { className: "max-w-2xl mx-auto w-full space-y-8 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100", children: [_jsxs("div", { className: "text-center space-y-3 pb-6 border-b border-stone-100", children: [_jsx("div", { className: "w-16 h-16 rounded-full bg-summer-pink/20 flex items-center justify-center mx-auto mb-4", children: _jsx("span", { className: "text-summer-pink text-3xl font-bold", children: "\u2713" }) }), _jsx("h1", { className: "font-title text-2xl uppercase tracking-wider text-stone-800", children: "\u00A1Ejercicio Completado!" }), _jsxs("p", { className: "font-secondary text-stone-600 leading-relaxed text-sm md:text-base", children: ["Felicitaciones por completar el ejercicio de Primeros Auxilios Emocionales. El objetivo principal era aplicar la metodolog\u00EDa OASIS con ", scenario.persona.name, ". A continuaci\u00F3n te presentamos un reporte de tu desempe\u00F1o."] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-title text-lg uppercase tracking-wide text-stone-800", children: "1. Competencias Demostradas" }), _jsxs("div", { className: "bg-summer-teal/10 text-summer-teal font-secondary font-semibold px-3 py-1 rounded-full text-sm", children: ["Nivel de logro: ", matchingLevel, "%"] })] }), matchedTags.length > 0 ? (_jsx("ul", { className: "space-y-3", children: matchedTags.map(tagId => (_jsxs("li", { className: "flex items-start gap-3 bg-summer-teal/5 p-4 rounded-2xl border border-summer-teal/20", children: [_jsx("span", { className: "text-summer-teal mt-0.5 font-bold", children: "\u2713" }), _jsxs("div", { children: [_jsx("p", { className: "font-secondary font-semibold text-stone-800 text-sm", children: tagId.replace(/_/g, " ").replace("T ", "TAG ") }), _jsx("p", { className: "font-secondary text-xs text-stone-500 mt-1", children: "Has demostrado evidencia de esta competencia durante la sesi\u00F3n." })] })] }, tagId))) })) : (_jsx("p", { className: "font-secondary text-sm text-stone-500 italic bg-stone-50 p-4 rounded-2xl", children: "No se detectaron competencias completas en esta sesi\u00F3n." }))] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h2", { className: "font-title text-lg uppercase tracking-wide text-stone-800", children: "2. Oportunidades de Mejora" }), missingTags.length > 0 ? (_jsx("ul", { className: "space-y-3", children: missingTags.map(tagId => (_jsxs("li", { className: "flex items-start gap-3 bg-summer-peach/10 p-4 rounded-2xl border border-summer-peach/30", children: [_jsx("span", { className: "text-summer-peach mt-0.5 font-bold", children: "\u25CB" }), _jsxs("div", { children: [_jsx("p", { className: "font-secondary font-semibold text-stone-800 text-sm", children: tagId.replace(/_/g, " ").replace("T ", "TAG ") }), _jsx("p", { className: "font-secondary text-xs text-stone-600 mt-1", children: "Recomendaci\u00F3n: Intenta enfocarte en aplicar esta fase de la metodolog\u00EDa en tu pr\u00F3xima pr\u00E1ctica." })] })] }, tagId))) })) : (_jsx("p", { className: "font-secondary text-sm text-summer-teal bg-summer-teal/10 p-4 rounded-2xl", children: "\u00A1Excelente! Has cubierto todas las competencias esperadas." }))] }), _jsxs("div", { className: "bg-summer-blue/5 p-6 rounded-3xl border border-summer-blue/20", children: [_jsx("h3", { className: "font-title uppercase tracking-wide text-stone-800 mb-2", children: "Conclusi\u00F3n General" }), _jsx("p", { className: "font-secondary text-sm text-stone-600 leading-relaxed", children: matchingLevel >= 80
                                ? "Has demostrado un excelente dominio de la metodología OASIS. Mantuviste una postura acogedora y lograste guiar la conversación hacia la red de apoyo."
                                : matchingLevel >= 50
                                    ? "Vas por buen camino. Has logrado aplicar varias herramientas de contención, pero aún hay espacios para fortalecer la escucha activa y la validación."
                                    : "Este es un buen primer acercamiento. Te invitamos a revisar el material de la metodología y volver a intentarlo para integrar mejor las fases de Observar, Acoger y Sostener." })] }), _jsx("div", { className: "pt-6 border-t border-stone-100", children: _jsx("button", { onClick: () => navigate("/scenarios"), className: "w-full bg-summer-blue hover:bg-blue-400 text-white font-secondary rounded-2xl py-4 text-sm font-bold tracking-wide transition-colors", children: "Volver a Escenarios" }) })] }) }));
}
