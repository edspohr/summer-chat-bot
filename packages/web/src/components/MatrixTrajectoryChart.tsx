import type { EstadoMatriz } from "@salvador/shared";

interface MatrixTrajectoryChartProps {
  /** Initial matrix state (from `initialMatrixFor(scenarioId)`). */
  initial: EstadoMatriz;
  /** Final matrix state from the session. */
  final: EstadoMatriz | null;
  /**
   * Per-turn trajectory: each entry is the matrix state AFTER that trainee
   * turn. Optional — if absent the chart draws a two-point line from
   * initial to final. Mobile-first Tailwind + inline SVG, no chart lib.
   */
  turns?: EstadoMatriz[];
}

// Three horizontal lanes (intensidad, apertura, confianza). Each shows a
// mini line chart of the value over turns. Mobile-first, no library.
// Not a precision chart — the goal is "movement, direction, endpoint".
export function MatrixTrajectoryChart({ initial, final, turns }: MatrixTrajectoryChartProps) {
  const points = [initial, ...(turns ?? []), ...(final !== null && turns === undefined ? [final] : [])];
  if (points.length < 2 && final !== null) points.push(final);

  const variables: Array<{
    key: "intensidadEmocional" | "apertura" | "confianzaEnLaAyuda";
    label: string;
    hint: string;
    accent: string;
    goodDirection: "up" | "down";
  }> = [
    { key: "intensidadEmocional", label: "Intensidad emocional", hint: "Mejor si baja", accent: "text-summer-peach", goodDirection: "down" },
    { key: "apertura", label: "Apertura", hint: "Mejor si sube", accent: "text-summer-teal", goodDirection: "up" },
    { key: "confianzaEnLaAyuda", label: "Confianza en la ayuda", hint: "Mejor si sube", accent: "text-summer-blue", goodDirection: "up" },
  ];

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-stone-100 p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="font-title uppercase tracking-wide text-stone-800 text-sm">
          Cómo se movió la conversación
        </h2>
        <p className="font-secondary text-xs text-stone-500 mt-1">
          Las tres variables emocionales de Martina a lo largo de la sesión.
        </p>
      </div>
      <div className="space-y-4">
        {variables.map((v) => {
          const values = points.map((p) => p[v.key]);
          const first = values[0] ?? 0;
          const last = values[values.length - 1] ?? 0;
          const delta = last - first;
          const arrow = delta === 0 ? "=" : delta > 0 ? "↑" : "↓";
          const good = delta !== 0 && ((v.goodDirection === "up" && delta > 0) || (v.goodDirection === "down" && delta < 0));
          const deltaColor = delta === 0 ? "text-stone-400" : good ? "text-summer-teal" : "text-summer-peach";
          return (
            <div key={v.key} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="font-secondary text-sm text-stone-800 flex-1">{v.label}</p>
                <span className={`font-secondary text-xs ${deltaColor} tabular-nums`}>
                  {first} {arrow} {last}
                </span>
              </div>
              <TrajectorySpark values={values} accentClass={v.accent} />
              <p className="font-secondary text-[11px] text-stone-400">{v.hint}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// SVG polyline scaled to a 200×32 viewport. Values 0..10 map to y=28..4.
function TrajectorySpark({ values, accentClass }: { values: number[]; accentClass: string }) {
  const w = 200;
  const h = 32;
  const yMax = 10;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const toXY = (v: number, i: number) => ({ x: Math.round(i * step), y: Math.round(28 - (v / yMax) * 24) });
  const pts = values.map(toXY);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full h-8 ${accentClass}`} role="img" aria-label="Trayectoria">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="currentColor" />
      ))}
    </svg>
  );
}
