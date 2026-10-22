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
  { key: "", label: "Todas las llamadas", className: "" },
  ...Object.entries(CALL_STATES).map(([key, s]) => ({ key, label: s.label, className: s.className })),
];

export const GESTION_FILTERS = [
  { key: "", label: "Toda la gestión", className: "" },
  ...GESTION_STATES.map((g) => ({ key: g.key, label: g.label, className: g.className })),
];

export const MODALIDAD_FILTERS = [
  { key: "", label: "Toda modalidad", className: "" },
  { key: "presencial", label: "Presencial", className: "bg-violet-100 text-violet-800 border border-violet-200" },
  { key: "videoconferencia", label: "Meet / videoconferencia", className: "bg-sky-100 text-sky-800 border border-sky-200" },
  { key: "sin_reunion", label: "Sin cita", className: "bg-paper-border text-paper-muted" },
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

// Los leads del chat o de una derivación nunca reciben llamada automática: no se muestra "Sin llamar".
const PHONE_SOURCE = /llamada|\{\{/i;
const PHONE_CALL_STATE = {
  label: "Llamó al despacho",
  description: "La persona llamó al número del despacho. No hace falta llamarle.",
  className: "bg-sky-100 text-sky-800 border border-sky-200",
};
const NO_CALL_STATE = {
  label: "No aplica",
  description: "Llegó por el chat del web o por una derivación. No hay llamada automática.",
  className: "bg-paper-border text-paper-muted",
};

type CallLead = { status: string | null; source: string | null };

// Estado de la llamada según el origen del lead.
export function getCallState(lead: CallLead) {
  const source = lead.source ?? "";
  if (PHONE_SOURCE.test(source)) return PHONE_CALL_STATE;
  // Formulario web: "Sin llamar" hasta que el agente llame. Otros orígenes solo si hubo intentos de llamada.
  const hasCallHistory = Boolean(lead.status && lead.status !== "pending_contact" && lead.status in CALL_STATES);
  if (source === "Formulario" || hasCallHistory) return getStatusPill(lead.status);
  return NO_CALL_STATE;
}

// De dónde llegó el lead, a partir del campo source que guarda cada flujo.
export function getOriginPill(source: string | null) {
  const value = (source ?? "").trim();
  if (!value) return { label: "—", className: "bg-paper-border text-paper-muted" };
  if (PHONE_SOURCE.test(value)) return { label: "Llamada", className: "bg-sky-100 text-sky-800 border border-sky-200" };
  if (/^web chat$|chatbot|chat/i.test(value)) return { label: "Widget", className: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  if (/formulario/i.test(value)) return { label: "Formulario", className: "bg-amber-100 text-amber-800 border border-amber-200" };
  return { label: value, className: "bg-paper-border text-paper-muted" };
}

export const APPOINTMENT_GESTION_KEYS =["cita_pendiente", "cita_confirmada"];

// Una cita solo existe si tiene fecha y modalidad. Sin ellas no se puede confirmar ni tener pendiente.
export function hasAppointment(lead: { cita_inicio: string | Date | null; fecha: string | Date | null; modalidad: string | null }): boolean {
  return Boolean(lead.cita_inicio || lead.fecha) && Boolean(lead.modalidad?.trim());
}

// Estados de gestión que se pueden elegir para un lead: los de cita solo si tiene cita (o el que ya tiene).
export function gestionOptionsFor(current: string | null, appointment: boolean) {
  return GESTION_STATES.filter((g) => appointment || !APPOINTMENT_GESTION_KEYS.includes(g.key) || g.key === current);
}
