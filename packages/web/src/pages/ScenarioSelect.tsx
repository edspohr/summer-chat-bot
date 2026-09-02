import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";
import { ScenarioSchema, type Scenario } from "@salvador/shared";
import { useAuth } from "../hooks/useAuth.js";

export default function ScenarioSelect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "scenarios"), where("active", "==", true));
    getDocs(q)
      .then((snap) => {
        const list: Scenario[] = [];
        for (const d of snap.docs) {
          const parsed = ScenarioSchema.safeParse({ id: d.id, ...d.data() });
          if (parsed.success) list.push(parsed.data);
        }
        setScenarios(list);
      })
      .catch(() => setError("Error al cargar los escenarios"))
      .finally(() => setLoading(false));
  }, [user]);

  function startSession(scenarioId: string) {
    const sessionId = crypto.randomUUID();
    navigate(`/session/${sessionId}?scenarioId=${scenarioId}`);
  }

  if (loading || authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-warm-bg">
        <p className="text-stone-400 text-sm">Cargando escenarios...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-warm-bg">
      <header className="px-4 py-4 border-b border-stone-100 bg-white flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate("/inicio")}
          className="text-stone-400 hover:text-summer-blue text-xl px-1 transition-colors"
        >
          ←
        </button>
        <div>
          <h1 className="font-title uppercase tracking-wider text-summer-blue text-xl">Modo Coach</h1>
          <p className="font-secondary text-xs text-stone-500">Elige un escenario de simulación</p>
        </div>
      </header>

      <div className="flex-1 px-8 py-10 max-w-7xl mx-auto w-full">
        {error !== null && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        {scenarios.length === 0 && error === null && (
          <div className="text-center py-12 space-y-2">
            <p className="text-stone-400 text-sm">No hay escenarios disponibles en este momento.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => startSession(s.id)}
              className="group flex flex-col bg-white border border-stone-100 hover:border-summer-teal hover:shadow-xl rounded-[2.5rem] overflow-hidden transition-all duration-300 text-left"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-summer-pink/10 relative">
                {s.persona.avatarUrl ? (
                  <img 
                    src={s.persona.avatarUrl} 
                    alt={s.persona.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-summer-pink font-title text-7xl">
                    {s.persona.name.charAt(0)}
                  </div>
                )}
                <div className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm group-hover:bg-summer-teal group-hover:text-white transition-all">
                  <span className="text-xl">→</span>
                </div>
              </div>

              <div className="p-8 flex-1 flex flex-col space-y-4">
                <div>
                  <h3 className="font-title uppercase tracking-wider text-stone-800 text-2xl group-hover:text-summer-teal transition-colors">
                    {s.persona.name}
                  </h3>
                  <p className="font-secondary text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">
                    {s.persona.age} años · {s.persona.role}
                  </p>
                </div>
                
                <p className="font-secondary text-sm text-stone-600 leading-relaxed line-clamp-3">
                  {s.description}
                </p>

                <div className="pt-2 mt-auto">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-summer-teal/10 text-summer-teal font-secondary text-xs font-bold uppercase tracking-tighter">
                    <span className="w-2 h-2 rounded-full bg-summer-teal animate-pulse" />
                    {s.requiredTags.length} competencias
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
