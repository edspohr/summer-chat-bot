import { useEffect, useRef } from "react";

interface FramingModalProps {
  onAcknowledge: () => void;
}

// Copy is centralised so the clinical team can edit in one place.
// Text is user-facing Spanish (Chile); do NOT translate to English.
const FRAMING_COPY = {
  title: "Antes de comenzar",
  intro:
    "Estás por entrar a una simulación de entrenamiento. Lee esto con calma, toma menos de un minuto.",
  points: [
    {
      heading: "Martina no es una persona real.",
      body:
        "Es un personaje creado por Fundación Summer para que practiques primeros auxilios emocionales. No es un chatbot de apoyo ni de contención.",
    },
    {
      heading: "Es un espacio de sparring.",
      body:
        "Martina puede cerrarse, resistirse o ponerte a prueba. Eso es parte del ejercicio, no un juicio sobre ti. Aquí se puede equivocar y volver a intentar.",
    },
    {
      heading: "Habla desde tu rol, no desde tu historia.",
      body:
        "Acompáñala como docente. Si la conversación te remueve algo personal, puedes detenerte cuando quieras; el botón de ayuda estará siempre visible.",
    },
    {
      heading: "Tu sesión es anónima.",
      body:
        "No pedimos tu nombre ni datos personales. Lo que escribes se usa solo de forma agregada y anónima para mejorar el entrenamiento y reportar los resultados del piloto.",
    },
  ],
  warning:
    "Si tú o alguien cercano está en riesgo ahora, no uses esta herramienta. Llama al *4141 (Salud Responde, 24 horas).",
  button: "Entiendo, quiero comenzar",
  fineprint:
    "Al continuar aceptas participar en esta simulación en los términos descritos.",
} as const;

// Rotating pastel bullet colors — matches the summer palette guidelines.
const BULLET_COLORS = [
  "bg-summer-teal",
  "bg-summer-yellow",
  "bg-summer-peach",
  "bg-summer-pink",
] as const;

export function FramingModal({ onAcknowledge }: FramingModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();

    // Focus trap: Tab / Shift+Tab cycle within the modal. Escape is ignored.
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        return;
      }
      if (e.key !== "Tab") return;
      const root = containerRef.current;
      if (root === null) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/40 flex items-stretch sm:items-center sm:justify-center sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="framing-title"
    >
      <div
        ref={containerRef}
        className="w-full sm:max-w-lg bg-warm-bg rounded-none sm:rounded-3xl shadow-md p-6 sm:p-8 my-0 sm:my-8 flex flex-col"
        style={{
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex flex-col items-center text-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-summer-peach/20 overflow-hidden border border-stone-100 shadow-sm">
            <img
              src="/avatar-martina-v3.png"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
              style={{ objectPosition: "50% 30%", transform: "scale(1.7)", transformOrigin: "50% 32%" }}
            />
          </div>
          <h2
            id="framing-title"
            className="font-title uppercase tracking-wide text-summer-blue text-xl sm:text-2xl"
          >
            {FRAMING_COPY.title}
          </h2>
          <p className="font-secondary text-sm text-stone-700 leading-relaxed">
            {FRAMING_COPY.intro}
          </p>
        </div>

        <ul className="space-y-4 mb-5">
          {FRAMING_COPY.points.map((p, i) => {
            const color = BULLET_COLORS[i % BULLET_COLORS.length] ?? BULLET_COLORS[0];
            return (
              <li key={p.heading} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`}
                />
                <div className="flex-1">
                  <p className="font-secondary font-semibold text-sm text-stone-800">{p.heading}</p>
                  <p className="font-secondary text-sm text-stone-600 leading-relaxed mt-0.5">
                    {p.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="bg-summer-yellow/60 rounded-2xl px-4 py-3 mb-5">
          <p className="font-secondary text-xs sm:text-sm text-stone-800 leading-relaxed">
            {FRAMING_COPY.warning}
          </p>
        </div>

        <button
          ref={buttonRef}
          type="button"
          onClick={onAcknowledge}
          className="w-full bg-summer-blue text-white rounded-full py-3.5 font-secondary font-semibold text-sm shadow-sm hover:scale-[1.02] transition-all"
        >
          {FRAMING_COPY.button}
        </button>
        <p className="font-secondary text-[11px] text-stone-400 leading-relaxed text-center mt-3">
          {FRAMING_COPY.fineprint}
        </p>
      </div>
    </div>
  );
}
