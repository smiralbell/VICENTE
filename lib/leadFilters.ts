export type LeadFilters = {
  status?: string;
  modalidad?: string;
  from?: string;
  to?: string;
};

export function isDateFilter(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const LEAD_STATUS_FILTERS = [
  { key: "", label: "Todos los estados" },
  { key: "pending_contact", label: "Pendiente" },
  { key: "contacted", label: "Contactado" },
  { key: "no_answer", label: "No contesta" },
  { key: "retry_pending", label: "Reintento pendiente" },
];

export const MODALIDAD_FILTERS = [
  { key: "", label: "Todas las modalidades" },
  { key: "presencial", label: "Presencial" },
  { key: "no_presencial", label: "No presencial" },
  { key: "sin_reunion", label: "Sin reunión" },
];

export function isLeadStatusFilter(value: string): boolean {
  return LEAD_STATUS_FILTERS.some((f) => f.key === value);
}

export function isModalidadFilter(value: string): boolean {
  return MODALIDAD_FILTERS.some((f) => f.key === value);
}

const STATUS_PILLS: Record<string, { label: string; className: string }> = {
  pending_contact: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
  },
  contacted: {
    label: "Contactado",
    className: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  },
  no_answer: {
    label: "No contesta",
    className: "bg-rose-100 text-rose-800 border border-rose-200",
  },
  retry_pending: {
    label: "Reintento pendiente",
    className: "bg-orange-100 text-orange-800 border border-orange-200",
  },
};

export function getStatusPill(status: string | null) {
  if (!status) {
    return { label: "Sin estado", className: "bg-paper-border text-paper-muted" };
  }
  return (
    STATUS_PILLS[status] ?? { label: status, className: "bg-paper-border text-paper-muted" }
  );
}
