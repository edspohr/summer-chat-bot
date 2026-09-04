// Centralised list of external help resources shown in the HelpSheet and any
// future crisis-related UI. Keep this the single source of truth so the
// clinical team only needs to validate one place.
//
// TODO(edmundo): validate list, wording and hours with Fundación Summer's
// clinical team before production.

export interface HelpResourcePhone {
  readonly kind: "phone";
  readonly name: string;
  readonly detail: string;
  readonly tel: string;
}

export interface HelpResourceLink {
  readonly kind: "link";
  readonly name: string;
  readonly detail: string;
  readonly url: string;
}

export type HelpResource = HelpResourcePhone | HelpResourceLink;

export const HELP_RESOURCES: readonly HelpResource[] = [
  {
    kind: "phone",
    name: "*4141",
    detail: "Línea de Prevención del Suicidio del MINSAL. 24 horas, gratuita.",
    tel: "*4141",
  },
  {
    kind: "phone",
    name: "600 360 7777",
    detail: "Salud Responde, Ministerio de Salud. 24 horas.",
    tel: "6003607777",
  },
  {
    kind: "phone",
    name: "Línea Libre 1515",
    detail: "Apoyo para niños, niñas y adolescentes (Fundación para la Confianza).",
    tel: "1515",
  },
  {
    kind: "link",
    name: "Fundación Summer",
    detail: "Conoce la metodología OASIS y sus recursos.",
    url: "https://fundacionsummer.cl",
  },
] as const;
