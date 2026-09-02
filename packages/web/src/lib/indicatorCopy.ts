// Copy for every indicator card on the admin dashboard (MED-02).
// The Summer team edits titles and subtitles here; the dashboard code
// pulls values by key, so wording changes never touch business logic.
//
// Keep subtitles short (one line ideal) and make the denominator explicit
// — every "%" or median needs the reader to know what it's over.

export interface IndicatorCopy {
  title: string;
  subtitle: string;
}

export const INDICATOR_COPY = {
  sessionsStarted: {
    title: "Sesiones iniciadas",
    subtitle: "Sesiones que iniciaron el primer turno del aprendiz en este día.",
  },
  uniqueDevices: {
    title: "Dispositivos únicos",
    subtitle:
      "Identificadores anónimos distintos que iniciaron al menos una sesión. Un dispositivo puede corresponder a más de una persona.",
  },
  completionRate: {
    title: "Tasa de completación",
    subtitle:
      "Sesiones cerradas normalmente sobre el total de sesiones iniciadas. No incluye sesiones cerradas por inactividad ni por crisis.",
  },
  dwellMedian: {
    title: "Permanencia mediana",
    subtitle:
      "Tiempo entre el primer y el último turno del aprendiz. Sobre sesiones con inicio registrado.",
  },
  turnsMedian: {
    title: "Turnos por sesión (mediana)",
    subtitle:
      "Turnos del aprendiz por sesión. Sobre sesiones con al menos un turno.",
  },
  tagsPerSession: {
    title: "Conductas OASIS por sesión (mediana)",
    subtitle:
      "Conductas OASIS reconocidas por el evaluador en cada sesión. Sobre sesiones iniciadas.",
  },
  matrixMovement: {
    title: "Movimiento de matriz",
    subtitle:
      "Sesiones donde al menos una variable emocional cambió respecto a su valor inicial.",
  },
  endStateCounts: {
    title: "Estado final",
    subtitle:
      "Cómo terminó cada sesión (completada, inactividad, crisis, abandonada).",
  },
  safeguardActivations: {
    title: "Activaciones de seguridad",
    subtitle:
      "Turnos que dispararon una capa de resguardo (L1, L2 o L3). Conteo bruto.",
  },
  nudgesSent: {
    title: "Recordatorios enviados",
    subtitle: "Recordatorios enviados tras 2 minutos de inactividad del aprendiz.",
  },
  repliesAfterNudge: {
    title: "Respuestas tras recordatorio",
    subtitle: "Turnos del aprendiz recibidos después de un recordatorio.",
  },
} as const satisfies Record<string, IndicatorCopy>;

export type IndicatorKey = keyof typeof INDICATOR_COPY;
