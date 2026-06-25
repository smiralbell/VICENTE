export type Priority = "low" | "medium" | "high" | "critical";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type StatusFilter = "all" | TicketStatus;

export type TicketListItem = {
  id: number;
  external_id: string;
  title: string | null;
  description: string | null;
  priority: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  latest_message: string | null;
  latest_updated_by: string | null;
};

export type TicketUpdateItem = {
  id: number;
  event: string | null;
  status: string | null;
  message: string | null;
  updated_by: string | null;
  buffalo_updated_at: string | null;
  created_at: string;
};

export type TicketDetail = {
  ticket: {
    id: number;
    external_id: string;
    title: string | null;
    description: string | null;
    priority: string;
    status: TicketStatus;
    reporter_name: string | null;
    reporter_email: string | null;
    fields: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
  };
  updates: TicketUpdateItem[];
};

export function getStatusPill(status: TicketStatus | string) {
  switch (status) {
    case "in_progress":
      return { label: "En revisión", className: "bg-sky-100 text-sky-800 border border-sky-200" };
    case "resolved":
      return { label: "Resuelto", className: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
    case "closed":
      return { label: "Cerrado", className: "bg-paper-border text-paper-muted border border-paper-border" };
    default:
      return { label: "Pendiente", className: "bg-amber-100 text-amber-800 border border-amber-200" };
  }
}

export function getPriorityLabel(priority: string) {
  switch (priority) {
    case "low":
      return "Baja";
    case "high":
      return "Alta";
    case "critical":
      return "Crítica";
    default:
      return "Media";
  }
}

export function getPriorityClass(priority: string) {
  switch (priority) {
    case "low":
      return "text-paper-muted";
    case "high":
      return "text-orange-700";
    case "critical":
      return "text-red-700 font-medium";
    default:
      return "text-paper-inkLight";
  }
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export const inputClass =
  "w-full rounded border border-paper-border bg-paper-card px-3 py-2.5 text-sm text-paper-ink placeholder-paper-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export const labelClass =
  "text-[11px] font-medium uppercase tracking-wider text-paper-muted";

export const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "open", label: "Pendientes" },
  { key: "in_progress", label: "En revisión" },
  { key: "resolved", label: "Resueltos" },
  { key: "closed", label: "Cerrados" },
];
