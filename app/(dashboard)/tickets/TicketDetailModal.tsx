"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import {
  formatDate,
  getPriorityClass,
  getPriorityLabel,
  getStatusPill,
  type TicketDetail,
} from "./ticketUtils";

type Props = {
  ticketId: number | null;
  onClose: () => void;
};

type TimelineEntry = {
  id: string;
  kind: "created" | "update";
  title: string;
  message: string | null;
  status: string | null;
  author: string | null;
  date: string;
};

function buildTimeline(detail: TicketDetail): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      id: "created",
      kind: "created",
      title: "Incidencia creada",
      message: detail.ticket.description,
      status: "open",
      author: detail.ticket.reporter_name,
      date: detail.ticket.created_at,
    },
  ];

  for (const update of detail.updates) {
    const statusLabel = update.status ? getStatusPill(update.status).label : null;
    entries.push({
      id: `update-${update.id}`,
      kind: "update",
      title:
        update.event === "status_change" && statusLabel
          ? `Estado actualizado a «${statusLabel}»`
          : update.event === "comment"
            ? "Nuevo comentario"
            : "Actualización de soporte",
      message: update.message,
      status: update.status,
      author: update.updated_by,
      date: update.buffalo_updated_at ?? update.created_at,
    });
  }

  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default function TicketDetailModal({ ticketId, onClose }: Props) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadDetail = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar el ticket");
      }
      setDetail(data);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : "Error al cargar el ticket");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticketId) void loadDetail(ticketId);
    else setDetail(null);
  }, [ticketId, loadDetail]);

  useEffect(() => {
    if (!ticketId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [ticketId, onClose]);

  if (!ticketId || !mounted) return null;

  const pill = detail ? getStatusPill(detail.ticket.status) : null;
  const timeline = detail ? buildTimeline(detail) : [];
  const fields = detail?.ticket.fields ?? null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-detail-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-paper-border bg-paper-card shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-paper-border px-5 py-4">
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="h-6 w-48 animate-pulse rounded bg-paper" />
            ) : detail ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="ticket-detail-title"
                    className="font-serif text-lg font-medium text-paper-ink"
                  >
                    {detail.ticket.title || "Sin título"}
                  </h2>
                  {pill && (
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${pill.className}`}
                    >
                      {pill.label}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[11px] text-paper-muted">
                  {detail.ticket.external_id}
                </p>
              </>
            ) : (
              <h2 id="ticket-detail-title" className="font-serif text-lg font-medium text-paper-ink">
                Detalle del ticket
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-paper-muted hover:bg-paper hover:text-paper-ink"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-4">
              <div className="h-20 animate-pulse rounded-lg bg-paper" />
              <div className="h-40 animate-pulse rounded-lg bg-paper" />
            </div>
          ) : error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : detail ? (
            <>
              <dl className="grid gap-3 rounded-lg border border-paper-border bg-paper p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
                    Prioridad
                  </dt>
                  <dd className={`mt-0.5 ${getPriorityClass(detail.ticket.priority)}`}>
                    {getPriorityLabel(detail.ticket.priority)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
                    Creado
                  </dt>
                  <dd className="mt-0.5 text-paper-ink">{formatDate(detail.ticket.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
                    Última actualización
                  </dt>
                  <dd className="mt-0.5 text-paper-ink">{formatDate(detail.ticket.updated_at)}</dd>
                </div>
                {(detail.ticket.reporter_name || detail.ticket.reporter_email) && (
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
                      Reportado por
                    </dt>
                    <dd className="mt-0.5 text-paper-ink">
                      {[detail.ticket.reporter_name, detail.ticket.reporter_email]
                        .filter(Boolean)
                        .join(" · ")}
                    </dd>
                  </div>
                )}
                {fields && typeof fields === "object" && (
                  <>
                    {"modulo" in fields && fields.modulo ? (
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
                          Módulo
                        </dt>
                        <dd className="mt-0.5 text-paper-ink">{String(fields.modulo)}</dd>
                      </div>
                    ) : null}
                    {"url_pantalla" in fields && fields.url_pantalla ? (
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
                          Pantalla
                        </dt>
                        <dd className="mt-0.5 break-all text-paper-ink">
                          {String(fields.url_pantalla)}
                        </dd>
                      </div>
                    ) : null}
                  </>
                )}
              </dl>

              {detail.ticket.description && (
                <div className="mt-4">
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
                    Descripción
                  </h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-paper-ink">
                    {detail.ticket.description}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <h3 className="text-sm font-medium text-paper-ink">Seguimiento</h3>
                <p className="mt-0.5 text-xs text-paper-muted">
                  Historial de cambios y respuestas del equipo de soporte.
                </p>

                <ol className="relative mt-4 space-y-0 border-l border-paper-border pl-5">
                  {timeline.map((entry, index) => {
                    const isLast = index === timeline.length - 1;
                    const entryPill = entry.status ? getStatusPill(entry.status) : null;
                    return (
                      <li key={entry.id} className={`relative ${isLast ? "" : "pb-6"}`}>
                        <span
                          className={`absolute -left-[1.35rem] top-1 flex h-2.5 w-2.5 rounded-full ring-4 ring-paper-card ${
                            entry.kind === "created" ? "bg-brand" : "bg-sky-500"
                          }`}
                        />
                        <div className="rounded-lg border border-paper-border bg-paper p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-paper-ink">{entry.title}</p>
                            <time className="text-[11px] text-paper-muted">
                              {formatDate(entry.date)}
                            </time>
                          </div>
                          {entry.author && (
                            <p className="mt-0.5 text-xs text-paper-muted">{entry.author}</p>
                          )}
                          {entryPill && entry.kind === "update" && (
                            <span
                              className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${entryPill.className}`}
                            >
                              {entryPill.label}
                            </span>
                          )}
                          {entry.message && (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-paper-inkLight">
                              {entry.message}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {timeline.length === 1 && (
                  <p className="mt-3 text-xs text-paper-muted">
                    Aún no hay respuestas del equipo. Le notificaremos cuando haya novedades.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-paper-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-paper-border px-4 py-2.5 text-sm text-paper-inkLight hover:bg-paper"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
