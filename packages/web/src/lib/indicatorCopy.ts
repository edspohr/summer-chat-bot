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
  coachSessions: {
    title: "Sesiones con Martina",
    subtitle: "Sesiones de práctica (Coach) que comenzaron en el período. No incluye Mentor.",
  },
  reachedFiveMin: {
    title: "Llegaron a 5 min",
    subtitle: "Sesiones con al menos 5 minutos entre el primer y el último turno del participante, sobre las que tuvieron al menos un turno.",
  },
  dwellMedian: {
    title: "Permanencia mediana",
    subtitle: "Tiempo entre el primer y el último turno del participante. Sobre sesiones con inicio registrado.",
  },
  reportsReady: {
    title: "Informes formativos",
    subtitle: "Sesiones con informe entregado, sobre las que tuvieron 3 o más turnos (mínimo para generar informe).",
  },
  crisisSessions: {
    title: "Sesiones pausadas por crisis",
    subtitle: "Sesiones interrumpidas por una capa de seguridad. Sobre sesiones con Martina.",
  },
  userEndedRate: {
    title: "Cerradas por el participante",
    subtitle: "Sesiones que el participante terminó con el botón de cierre, sobre las que tuvieron al menos un turno. El resto cierra por inactividad o crisis.",
  },
  uniqueDevices: {
    title: "Dispositivos únicos por día",
    subtitle: "Promedio de identificadores anónimos distintos, solo en días con actividad. Un dispositivo puede corresponder a más de una persona.",
  },
  turnsMedian: {
    title: "Turnos por sesión (mediana)",
    subtitle: "Turnos del participante por sesión. Sobre sesiones con al menos un turno.",
  },
  tagsPerSession: {
    title: "Conductas OASIS por sesión (mediana)",
    subtitle: "Conductas OASIS reconocidas por el evaluador en cada sesión. Sobre sesiones iniciadas.",
  },
  matrixMovement: {
    title: "Movimiento de matriz",
    subtitle: "Sesiones donde al menos una variable emocional cambió respecto a su valor inicial. Sobre sesiones en modo escenario.",
  },
  mentorSessions: {
    title: "Sesiones con el Mentor",
    subtitle: "Consultas al Mentor (no evalúa ni hace roleplay). Se cuentan aparte de la práctica.",
  },
  safeguardActivations: {
    title: "Activaciones de seguridad",
    subtitle: "Turnos que dispararon una capa de resguardo (L1, L2 o L3). Conteo bruto de mensajes.",
  },
  nudgesSent: {
    title: "Recordatorios enviados",
    subtitle: "Recordatorios enviados tras 2 minutos de inactividad del participante.",
  },
  repliesAfterNudge: {
    title: "Respuestas tras recordatorio",
    subtitle: "Turnos del participante recibidos después de un recordatorio.",
  },
} as const satisfies Record<string, IndicatorCopy>;

export type IndicatorKey = keyof typeof INDICATOR_COPY;
