export type LeadFilters = {
  status?: string;
  gestion?: string;
  modalidad?: string;
  from?: string;
  to?: string;
};

export function isDateFilter(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Estado de la llamada: lo pone el sistema (agente de voz y reintentos).
export const CALL_STATES: Record<string, { label: string; description: string; className: string; dot: string }> = {
  pending_contact: {
    label: "Sin llamar",
    description: "El lead ha llegado y todavía no se le ha llamado con el agente de voz.",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
    dot: "bg-amber-400",
  },
  contacted: {
    label: "Contestó",
    description: "El agente de voz llamó y la persona contestó.",
    className: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    dot: "bg-emerald-500",
  },
  no_answer: {
    label: "No contesta",
    description: "Se llamó dos veces y nadie contestó. No se volverá a llamar automáticamente.",
    className: "bg-rose-100 text-rose-800 border border-rose-200",
    dot: "bg-rose-500",
  },
  retry_pending: {
    label: "Reintento pendiente",
    description: "No contestó la primera llamada. Está programado un segundo intento automático.",
    className: "bg-orange-100 text-orange-800 border border-orange-200",
    dot: "bg-orange-500",
  },
};

// Estado de gestión: lo cambian las personas del despacho.
export const GESTION_STATES: { key: string; label: string; description: string; className: string; dot: string }[] = [
  {
    key: "pendiente",
    label: "Pendiente de gestionar",
    description: "Nadie del despacho lo ha revisado todavía.",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    dot: "bg-slate-400",
  },
  {
    key: "cita_pendiente",
    label: "Cita pendiente de confirmar",
    description: "El agente ha agendado una consulta y falta que alguien del despacho la confirme.",
    className: "bg-sky-100 text-sky-800 border border-sky-200",
    dot: "bg-sky-500",
  },
  {
    key: "cita_confirmada",
    label: "Cita confirmada",
    description: "Un abogado ha confirmado la consulta.",
    className: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    key: "derivado",
    label: "Derivado a abogado",
    description: "El caso lo tiene que llevar un abogado concreto.",
    className: "bg-violet-100 text-violet-800 border border-violet-200",
    dot: "bg-violet-500",
  },
  {
    key: "cerrado",
    label: "Cerrado",
    description: "Caso resuelto o descartado.",
    className: "bg-zinc-200 text-zinc-700 border border-zinc-300",
    dot: "bg-zinc-500",
  },
];

export const GESTION_KEYS = GESTION_STATES.map((g) => g.key);

export function isGestionState(value: string): boolean {
  return GESTION_KEYS.includes(value);
}

export function getGestionState(key: string | null) {
  return GESTION_STATES.find((g) => g.key === key) ?? GESTION_STATES[0];
}

export const LEAD_STATUS_FILTERS = [
  { key: "", label: "Todas las llamadas", dot: "" },
  ...Object.entries(CALL_STATES).map(([key, s]) => ({ key, label: s.label, dot: s.dot })),
];

export const GESTION_FILTERS = [
  { key: "", label: "Toda la gestión", dot: "" },
  ...GESTION_STATES.map((g) => ({ key: g.key, label: g.label, dot: g.dot })),
];

export const MODALIDAD_FILTERS = [
  { key: "", label: "Toda modalidad", dot: "" },
  { key: "presencial", label: "Presencial", dot: "bg-violet-400" },
  { key: "videoconferencia", label: "Meet / videoconferencia", dot: "bg-sky-400" },
  { key: "sin_reunion", label: "Sin cita", dot: "bg-paper-border" },
];

export function isLeadStatusFilter(value: string): boolean {
  return LEAD_STATUS_FILTERS.some((f) => f.key === value);
}

export function isGestionFilter(value: string): boolean {
  return GESTION_FILTERS.some((f) => f.key === value);
}

export function isModalidadFilter(value: string): boolean {
  return MODALIDAD_FILTERS.some((f) => f.key === value);
}

export function getStatusPill(status: string | null) {
  if (!status) {
    return { label: "Sin llamar", description: "", className: "bg-paper-border text-paper-muted" };
  }
  const state = CALL_STATES[status];
  return state
    ? { label: state.label, description: state.description, className: state.className }
    : { label: status, description: "", className: "bg-paper-border text-paper-muted" };
}
