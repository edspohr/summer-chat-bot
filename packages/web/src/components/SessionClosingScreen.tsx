import { SESSION_COMPLETE_AT_SECONDS } from "@salvador/shared";

interface SessionClosingScreenProps {
  reason: "inactivity" | "user_ended";
  elapsedSeconds: number;
  onViewReport: () => void;
  onGoHome: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionClosingScreen({
  reason,
  elapsedSeconds,
  onViewReport,
  onGoHome,
}: SessionClosingScreenProps) {
  const completeEnough = elapsedSeconds >= SESSION_COMPLETE_AT_SECONDS;

  const title =
    reason === "inactivity"
      ? "La sesión se cerró por inactividad"
      : "Sesión finalizada";

  const description =
    reason === "inactivity"
      ? completeEnough
        ? "Estuvieron un rato sin escribirse y la sesión se cerró sola. Ya alcanzaste el tramo suficiente para revisar tu informe."
        : "Estuvieron un rato sin escribirse y la sesión se cerró sola. Fue una conversación breve — puedes revisar lo que hubo o intentar de nuevo con Martina."
      : completeEnough
        ? "Cerraste la sesión. Cuando quieras, revisa tu informe."
        : "Cerraste la sesión antes de los 5 minutos. Puedes revisar el informe igual, o intentarlo de nuevo con más tiempo.";

  return (
    <div className="fixed inset-0 z-50 bg-warm-bg/95 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-stone-100 p-8 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-summer-teal/20 flex items-center justify-center mx-auto text-3xl">
          🌱
        </div>
        <div className="space-y-3 text-center">
          <h2 className="font-title uppercase tracking-wide text-stone-800 text-lg">
            {title}
          </h2>
          <p className="font-secondary text-sm text-stone-600 leading-relaxed">
            {description}
          </p>
          <p className="font-secondary text-xs text-stone-400">
            Duración: {formatDuration(elapsedSeconds)}
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={onViewReport}
            className="w-full bg-summer-blue hover:bg-blue-400 text-white rounded-2xl px-5 py-3 text-sm font-bold font-secondary tracking-wide transition-colors shadow-sm"
          >
            Ver mi informe
          </button>
          <button
            onClick={onGoHome}
            className="w-full bg-transparent hover:bg-stone-50 text-stone-500 rounded-2xl px-5 py-3 text-sm font-secondary tracking-wide transition-colors border border-stone-200"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
