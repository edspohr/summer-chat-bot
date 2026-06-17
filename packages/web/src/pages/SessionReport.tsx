import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useScenario } from "../hooks/useScenario.js";
import { useTagProgress } from "../hooks/useTagProgress.js";
import { useEffect } from "react";

export default function SessionReport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const scenarioId = searchParams.get("scenarioId") ?? "";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { scenario, loading: scenarioLoading } = useScenario(scenarioId);
  const tagProgressItems = useTagProgress(sessionId ?? "");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading || scenarioLoading || !scenario) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-warm-bg">
        <p className="text-stone-400 text-sm">Generando reporte...</p>
      </main>
    );
  }

  const completedTagIds = new Set(tagProgressItems.filter(t => t.completed).map(t => t.tagId));
  const expectedTags = scenario.requiredTags?.map(t => t.tagId) || [];
  
  const matchedTags = expectedTags.filter(tagId => completedTagIds.has(tagId));
  const missingTags = expectedTags.filter(tagId => !completedTagIds.has(tagId));

  const matchingLevel = expectedTags.length > 0 
    ? Math.round((matchedTags.length / expectedTags.length) * 100) 
    : 0;

  return (
    <main className="min-h-screen flex flex-col bg-warm-bg py-8 px-4">
      <div className="max-w-2xl mx-auto w-full space-y-8 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-stone-100">
        
        {/* Intro */}
        <div className="text-center space-y-3 pb-6 border-b border-stone-100">
          <div className="w-16 h-16 rounded-full bg-summer-pink/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-summer-pink text-3xl font-bold">✓</span>
          </div>
          <h1 className="font-title text-2xl uppercase tracking-wider text-stone-800">¡Ejercicio Completado!</h1>
          <p className="font-secondary text-stone-600 leading-relaxed text-sm md:text-base">
            Felicitaciones por completar el ejercicio de Primeros Auxilios Emocionales. 
            El objetivo principal era aplicar la metodología OASIS con {scenario.persona.name}. 
            A continuación te presentamos un reporte de tu desempeño.
          </p>
        </div>

        {/* 1. Expected Tags matched */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-title text-lg uppercase tracking-wide text-stone-800">1. Competencias Demostradas</h2>
            <div className="bg-summer-teal/10 text-summer-teal font-secondary font-semibold px-3 py-1 rounded-full text-sm">
              Nivel de logro: {matchingLevel}%
            </div>
          </div>
          
          {matchedTags.length > 0 ? (
            <ul className="space-y-3">
              {matchedTags.map(tagId => (
                <li key={tagId} className="flex items-start gap-3 bg-summer-teal/5 p-4 rounded-2xl border border-summer-teal/20">
                  <span className="text-summer-teal mt-0.5 font-bold">✓</span>
                  <div>
                    <p className="font-secondary font-semibold text-stone-800 text-sm">{tagId.replace(/_/g, " ").replace("T ", "TAG ")}</p>
                    <p className="font-secondary text-xs text-stone-500 mt-1">Has demostrado evidencia de esta competencia durante la sesión.</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-secondary text-sm text-stone-500 italic bg-stone-50 p-4 rounded-2xl">No se detectaron competencias completas en esta sesión.</p>
          )}
        </div>

        {/* 2. Expected Tags missing */}
        <div className="space-y-4">
          <h2 className="font-title text-lg uppercase tracking-wide text-stone-800">2. Oportunidades de Mejora</h2>
          
          {missingTags.length > 0 ? (
            <ul className="space-y-3">
              {missingTags.map(tagId => (
                <li key={tagId} className="flex items-start gap-3 bg-summer-peach/10 p-4 rounded-2xl border border-summer-peach/30">
                  <span className="text-summer-peach mt-0.5 font-bold">○</span>
                  <div>
                    <p className="font-secondary font-semibold text-stone-800 text-sm">{tagId.replace(/_/g, " ").replace("T ", "TAG ")}</p>
                    <p className="font-secondary text-xs text-stone-600 mt-1">Recomendación: Intenta enfocarte en aplicar esta fase de la metodología en tu próxima práctica.</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-secondary text-sm text-summer-teal bg-summer-teal/10 p-4 rounded-2xl">¡Excelente! Has cubierto todas las competencias esperadas.</p>
          )}
        </div>

        {/* General Overview */}
        <div className="bg-summer-blue/5 p-6 rounded-3xl border border-summer-blue/20">
          <h3 className="font-title uppercase tracking-wide text-stone-800 mb-2">Conclusión General</h3>
          <p className="font-secondary text-sm text-stone-600 leading-relaxed">
            {matchingLevel >= 80 
              ? "Has demostrado un excelente dominio de la metodología OASIS. Mantuviste una postura acogedora y lograste guiar la conversación hacia la red de apoyo."
              : matchingLevel >= 50
              ? "Vas por buen camino. Has logrado aplicar varias herramientas de contención, pero aún hay espacios para fortalecer la escucha activa y la validación."
              : "Este es un buen primer acercamiento. Te invitamos a revisar el material de la metodología y volver a intentarlo para integrar mejor las fases de Observar, Acoger y Sostener."}
          </p>
        </div>

        <div className="pt-6 border-t border-stone-100 flex flex-col gap-3">
          <button
            onClick={() => navigate("/martina")}
            className="w-full bg-summer-teal hover:bg-teal-400 text-white font-secondary rounded-2xl py-4 text-sm font-bold tracking-wide transition-colors shadow-sm"
          >
            Intentarlo de nuevo →
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-secondary rounded-2xl py-3 text-sm font-semibold tracking-wide transition-colors"
          >
            Volver al inicio
          </button>
        </div>

      </div>
    </main>
  );
}
