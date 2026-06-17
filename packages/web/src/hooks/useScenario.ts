import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { ScenarioSchema, type Scenario } from "@salvador/shared";

export function useScenario(scenarioId: string): { scenario: Scenario | null; loading: boolean; error: string | null } {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scenarioId) return;
    setLoading(true);
    setError(null);

    getDoc(doc(db, "scenarios", scenarioId))
      .then((snap) => {
        if (!snap.exists()) {
          setError("Escenario no encontrado");
          return;
        }
        const parsed = ScenarioSchema.safeParse({ id: snap.id, ...snap.data() });
        if (!parsed.success) {
          setError("Error al leer el escenario");
          return;
        }
        setScenario(parsed.data);
      })
      .catch(() => setError("Error al cargar el escenario"))
      .finally(() => setLoading(false));
  }, [scenarioId]);

  return { scenario, loading, error };
}
