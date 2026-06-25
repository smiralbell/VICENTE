"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CreateTicketModal from "./CreateTicketModal";
import TicketDetailModal from "./TicketDetailModal";
import {
  STATUS_FILTERS,
  formatDate,
  getPriorityClass,
  getPriorityLabel,
  getStatusPill,
  type StatusFilter,
  type TicketListItem,
  type TicketStatus,
} from "./ticketUtils";

export default function TicketsPageContent() {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", { cache: "no-store" });
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    if (statusFilter === "all") return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const counts = useMemo(() => {
    const base = { all: tickets.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of tickets) {
      if (t.status in base) base[t.status as TicketStatus] += 1;
    }
    return base;
  }, [tickets]);

  const openDetail = (id: number) => setSelectedTicketId(id);
  const closeDetail = () => setSelectedTicketId(null);

  return (
    <div className="w-full">
      <header className="mb-6 flex flex-col gap-4 border-b border-paper-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-xl font-medium text-paper-ink">Tickets</h1>
          <p className="mt-1 text-sm text-paper-muted">
            Consulte sus incidencias y el seguimiento del equipo de soporte.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void loadTickets()}
            className="min-h-[44px] rounded-lg border border-paper-border px-4 py-2.5 text-sm text-paper-inkLight hover:bg-paper"
          >
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva incidencia
          </button>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: counts.all, accent: "text-paper-ink" },
          { label: "Pendientes", value: counts.open, accent: "text-amber-700" },
          { label: "En revisión", value: counts.in_progress, accent: "text-sky-700" },
          { label: "Resueltos", value: counts.resolved + counts.closed, accent: "text-emerald-700" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-paper-border bg-paper-card px-4 py-3 shadow-sm"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
              {stat.label}
            </p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${stat.accent}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === key
                ? "bg-brand text-white"
                : "border border-paper-border bg-paper-card text-paper-inkLight hover:bg-paper"
            }`}
          >
            {label}
            {key !== "all" && (
              <span className="ml-1 opacity-70">({counts[key as TicketStatus]})</span>
            )}
          </button>
        ))}
      </div>

      <div className="border-t border-paper-border pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg border border-paper-border bg-paper"
              />
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-paper-border bg-paper px-4 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-paper-border">
              <svg className="h-6 w-6 text-paper-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-paper-ink">
              {statusFilter === "all"
                ? "No hay incidencias todavía"
                : "No hay incidencias con este filtro"}
            </p>
            <p className="mt-1 text-sm text-paper-muted">
              Cree una nueva incidencia para reportar un problema al equipo de soporte.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear incidencia
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredTickets.map((ticket) => {
                const pill = getStatusPill(ticket.status);
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => openDetail(ticket.id)}
                    className="w-full rounded-xl border border-paper-border bg-paper-card p-4 text-left shadow-sm transition-colors hover:bg-brand-subtle/50 active:bg-brand-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-paper-ink">
                          {ticket.title || "Sin título"}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-paper-muted">
                          {ticket.external_id}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${pill.className}`}
                      >
                        {pill.label}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-paper-muted">
                      <span className={getPriorityClass(ticket.priority)}>
                        {getPriorityLabel(ticket.priority)}
                      </span>
                      <span>·</span>
                      <span>{formatDate(ticket.created_at)}</span>
                    </div>
                    {ticket.latest_message && (
                      <p className="mt-2 line-clamp-2 text-sm text-paper-inkLight">
                        {ticket.latest_message}
                      </p>
                    )}
                    <p className="mt-2 text-xs font-medium text-brand">Ver seguimiento →</p>
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto max-md:hidden">
              <table className="w-full table-fixed" role="grid">
                <thead>
                  <tr className="border-b border-paper-border">
                    {["Referencia", "Título", "Estado", "Prioridad", "Creado", "Última respuesta"].map(
                      (label) => (
                        <th
                          key={label}
                          className="px-3 py-2.5 text-left text-[11px] font-medium tracking-wide text-paper-muted lg:py-3 lg:text-xs"
                        >
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => {
                    const pill = getStatusPill(ticket.status);
                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => openDetail(ticket.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetail(ticket.id);
                          }
                        }}
                        className="cursor-pointer border-b border-paper-border transition-colors hover:bg-brand-subtle/50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset"
                      >
                        <td className="truncate px-3 py-3 font-mono text-[11px] text-paper-muted lg:text-xs">
                          {ticket.external_id}
                        </td>
                        <td className="truncate px-3 py-3 text-sm font-medium text-paper-ink">
                          {ticket.title || "Sin título"}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pill.className}`}
                          >
                            {pill.label}
                          </span>
                        </td>
                        <td className={`px-3 py-3 text-sm ${getPriorityClass(ticket.priority)}`}>
                          {getPriorityLabel(ticket.priority)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-paper-muted">
                          {formatDate(ticket.created_at)}
                        </td>
                        <td className="truncate px-3 py-3 text-sm text-paper-inkLight">
                          {ticket.latest_message ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <CreateTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void loadTickets()}
      />

      <TicketDetailModal ticketId={selectedTicketId} onClose={closeDetail} />
    </div>
  );
}
