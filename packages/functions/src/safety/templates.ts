import type { SafetyTemplate } from "@salvador/shared";

export const TEMPLATE_REAL_DISTRESS_v1 = `Lo que escribiste me importa, y no quiero pasar de largo.

Salvador es una herramienta de entrenamiento, no un servicio clínico. No puedo acompañarte en una crisis real, pero hay personas que sí pueden, ahora mismo, y son gratis:

• hablemosdetodo.injuv.gob.cl — chat anónimo para personas de 15 a 29 años, atendido por psicólogos. Lunes a viernes 10:00–21:00, sábados 11:00–17:00.

• *4141 — Línea de Prevención del Suicidio. Gratis, 24 horas, todos los días. Te atiende un psicólogo o psicóloga.

• 600 360 7777 opción 2 — Salud Responde. Orientación en salud mental, también gratis y 24/7.

• 131 — SAMU. Solo si estás en peligro vital ahora mismo.

Llama, escribe, manda mensaje. Lo que sientes hoy puede cambiar, y no tienes que hacerlo solo o sola.

Esta sesión de Salvador queda en pausa. Cuando estés en condiciones, podrás reanudarla más adelante.`;

export const TEMPLATE_FRAME_BREAK_v1 = `Hace un momento sentí que ya no estabas dentro del ejercicio, sino contándome algo tuyo. Si me equivoco, perdona la pausa.

Si no me equivoco, prefiero detenernos un momento y decirte algo importante: Salvador es una herramienta de entrenamiento. No puedo cuidar bien una conversación que ya no es de práctica.

Pero hay espacios que sí pueden:

- hablemosdetodo.injuv.gob.cl — chat anónimo para 15–29 años, atendido por psicólogos. Lun–Vie 10:00–21:00, Sáb 11:00–17:00.

- *4141 — Línea de Prevención del Suicidio, 24/7, gratis.

- 600 360 7777 opción 2 — Salud Responde, 24/7.

Esta sesión queda pausada. Cuando estés listo o lista para volver al ejercicio, vas a poder retomar otro escenario desde el inicio.`;

interface TemplateAssertionError {
  template: SafetyTemplate;
  reason: string;
}

function runTemplatesSelfTest(): void {
  const errors: TemplateAssertionError[] = [];

  if (
    TEMPLATE_REAL_DISTRESS_v1.length < 600 ||
    TEMPLATE_REAL_DISTRESS_v1.length > 1100
  ) {
    errors.push({
      template: "REAL_DISTRESS",
      reason: `Length ${TEMPLATE_REAL_DISTRESS_v1.length} outside [600, 1100]`,
    });
  }
  const required = ["*4141", "600 360 7777", "hablemosdetodo", "131"] as const;
  for (const token of required) {
    if (!TEMPLATE_REAL_DISTRESS_v1.includes(token)) {
      errors.push({
        template: "REAL_DISTRESS",
        reason: `Missing required token: ${token}`,
      });
    }
  }

  if (
    TEMPLATE_FRAME_BREAK_v1.length < 500 ||
    TEMPLATE_FRAME_BREAK_v1.length > 900
  ) {
    errors.push({
      template: "FRAME_BREAK",
      reason: `Length ${TEMPLATE_FRAME_BREAK_v1.length} outside [500, 900]`,
    });
  }
  if (!TEMPLATE_FRAME_BREAK_v1.includes("Si me equivoco, perdona la pausa")) {
    errors.push({ template: "FRAME_BREAK", reason: "Missing 'Si me equivoco, perdona la pausa'" });
  }
  if (!TEMPLATE_FRAME_BREAK_v1.includes("hablemosdetodo")) {
    errors.push({
      template: "FRAME_BREAK",
      reason: "Missing adolescent-priority resource",
    });
  }

  if (errors.length > 0) {
    const msgs = errors.map((e) => `[${e.template}] ${e.reason}`).join("\n");
    console.error(`[TEMPLATES SELF-TEST FAIL]\n${msgs}`);
    throw new Error(`Templates self-test failed:\n${msgs}`);
  }
}

runTemplatesSelfTest();

export function getTemplate(template: SafetyTemplate): string {
  switch (template) {
    case "REAL_DISTRESS":
      return TEMPLATE_REAL_DISTRESS_v1;
    case "FRAME_BREAK":
      return TEMPLATE_FRAME_BREAK_v1;
  }
}
