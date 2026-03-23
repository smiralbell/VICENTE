"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useState } from "react";
import type { Lead, LeadSortField } from "@/lib/db";

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const hours = Number(match[4] ?? "0");
  const minutes = Number(match[5] ?? "0");
  const seconds = Number(match[6] ?? "0");

  const parsed = new Date(year, month, day, hours, minutes, seconds);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDate(d: Date | string | null | undefined) {
  const date = parseDate(d);
  if (!date) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

const COLUMNS: { key: LeadSortField | null; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "email", label: "Email" },
  { key: null, label: "Teléfono" },
  { key: "source", label: "Fuente" },
  { key: null, label: "Estado" },
  { key: null, label: "Intentos" },
  { key: null, label: "Resumen" },
  { key: null, label: "Horario reunión" },
  { key: null, label: "Modalidad" },
  { key: "created_at", label: "Creado" },
];

function getStatusPill(status: string | null) {
  if (!status) {
    return { label: "Sin estado", className: "bg-paper-border text-paper-muted" };
  }
  if (status === "pending_contact") {
    return {
      label: "Pendiente",
      className: "bg-amber-100 text-amber-800 border border-amber-200",
    };
  }
  if (status === "contacted") {
    return {
      label: "Contactado",
      className: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    };
  }
  return {
    label: status,
    className: "bg-paper-border text-paper-muted",
  };
}

function getModalidadPill(modalidad: string | null) {
  if (!modalidad) {
    return { label: "—", className: "bg-paper-border text-paper-muted" };
  }

  const normalized = modalidad.trim().toLowerCase();
  if (normalized === "videoconferencia") {
    return {
      label: "Videoconferencia",
      className: "bg-sky-100 text-sky-800 border border-sky-200",
    };
  }
  if (normalized === "presencial") {
    return {
      label: "Presencial",
      className: "bg-violet-100 text-violet-800 border border-violet-200",
    };
  }

  return {
    label: modalidad,
    className: "bg-paper-border text-paper-muted",
  };
}

function buildSortUrl(
  field: LeadSortField,
  currentSort: string,
  currentOrder: string,
  search: string,
  page: number
): string {
  const params = new URLSearchParams();
  params.set("sort", field);
  const nextOrder =
    currentSort === field && currentOrder === "desc" ? "asc" : "desc";
  params.set("order", nextOrder);
  params.set("page", String(page));
  if (search) params.set("q", search);
  return `/leads?${params.toString()}`;
}

type Props = {
  leads: Lead[];
  sortField: string;
  order: string;
  search: string;
  page: number;
};

export default function LeadsTable({
  leads,
  sortField,
  order,
  search,
  page,
}: Props) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const showSummaryTooltip = useCallback(
    (e: React.MouseEvent<HTMLTableCellElement>, summary: string | null) => {
      if (!summary || summary === "—") return;
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({
        text: summary,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    []
  );
  const hideSummaryTooltip = useCallback(() => setTooltip(null), []);

  const handleRowClick = (lead: Lead) => {
    if (lead.session_id) {
      router.push(`/conversations/${encodeURIComponent(lead.session_id)}`);
    } else {
      router.push(`/leads/${lead.id}`);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-paper-muted">
          No hay leads que coincidan con la búsqueda.
        </p>
        <p className="mt-1 text-xs text-paper-muted">
          Pruebe otros términos o borre el filtro.
        </p>
      </div>
    );
  }

  const currentSort = (["name", "email", "source", "created_at"] as const).includes(
    sortField as LeadSortField
  )
  ? sortField
  : "created_at";

  return (
    <>
      {/* Vista móvil: cards */}
      <div className="space-y-3 md:hidden">
        {leads.map((lead) => (
          <button
            key={lead.id}
            type="button"
            onClick={() => handleRowClick(lead)}
            className="w-full rounded-xl border border-paper-border bg-paper-card p-4 text-left shadow-sm transition-colors hover:bg-brand-subtle/50 active:bg-brand-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-paper-ink">{lead.name}</p>
                {lead.email && (
                  <p className="mt-1 truncate text-sm text-paper-inkLight">{lead.email}</p>
                )}
                {lead.phone && (
                  <p className="text-sm text-paper-muted">{lead.phone}</p>
                )}
              </div>
              <div className="shrink-0">
                {(() => {
                  const pill = getStatusPill(lead.status);
                  return (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${pill.className}`}
                    >
                      {pill.label}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-paper-muted">
              {lead.source && <span>{lead.source}</span>}
              <span>Reunión: {formatDate(lead.fecha)}</span>
              {(() => {
                const pill = getModalidadPill(lead.modalidad);
                return (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pill.className}`}
                  >
                    {pill.label}
                  </span>
                );
              })()}
              <span>{formatDate(lead.created_at)}</span>
              {typeof lead.call_attempts === "number" && (
                <span>Intentos: {lead.call_attempts}</span>
              )}
            </div>
            {lead.summary && (
              <p className="mt-2 line-clamp-2 text-sm text-paper-muted">{lead.summary}</p>
            )}
          </button>
        ))}
      </div>

      {/* Vista escritorio: tabla */}
      <div className="overflow-x-auto max-md:hidden">
      <table className="w-full table-fixed" role="grid">
        <thead>
          <tr className="border-b border-paper-border">
            {COLUMNS.map(({ key, label }, i) => (
              <th
                key={key ?? i}
                className={`py-2.5 text-left text-[11px] font-medium tracking-wide text-paper-muted lg:py-3 lg:text-xs ${
                  label === "Resumen"
                    ? "max-w-[160px] px-2 lg:max-w-[200px] lg:px-3"
                    : label === "Intentos"
                      ? "w-[70px] px-1 text-center lg:w-[80px] lg:px-2"
                      : "px-2 lg:px-3"
                } ${i === COLUMNS.length - 1 ? "pl-2 lg:pl-3" : ""}`}
              >
                {key ? (
                  <Link
                    href={buildSortUrl(
                      key,
                      currentSort,
                      order,
                      search,
                      page
                    )}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset focus:ring-offset-1 rounded"
                  >
                    {label}
                    {currentSort === key && (
                      <span className="text-brand" aria-hidden>
                        {order === "desc" ? "↓" : "↑"}
                      </span>
                    )}
                  </Link>
                ) : (
                  label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              onClick={() => handleRowClick(lead)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRowClick(lead);
                }
              }}
              className="cursor-pointer border-b border-paper-border transition-colors hover:bg-brand-subtle/50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset"
            >
              <td className="truncate py-2.5 px-2 text-xs font-medium text-paper-ink lg:py-3 lg:px-3 lg:text-sm">
                {lead.name}
              </td>
              <td className="truncate py-2.5 px-2 text-xs text-paper-inkLight lg:py-3 lg:px-3 lg:text-sm">
                {lead.email}
              </td>
              <td className="truncate py-2.5 px-2 text-xs text-paper-inkLight lg:py-3 lg:px-3 lg:text-sm">
                {lead.phone ?? "—"}
              </td>
              <td className="truncate py-2.5 px-2 text-xs text-paper-muted lg:py-3 lg:px-3 lg:text-sm">
                {lead.source ?? "—"}
              </td>
              <td className="py-2.5 px-2 text-xs text-paper-muted lg:py-3 lg:px-3 lg:text-sm">
                {(() => {
                  const pill = getStatusPill(lead.status);
                  return (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pill.className}`}
                    >
                      {pill.label}
                    </span>
                  );
                })()}
              </td>
              <td className="w-[70px] py-2.5 px-1 text-center text-xs text-paper-inkLight lg:w-[80px] lg:py-3 lg:px-2 lg:text-sm">
                {typeof lead.call_attempts === "number" ? lead.call_attempts : "—"}
              </td>
              <td
                className="max-w-[160px] truncate py-2.5 px-2 text-xs text-paper-muted lg:max-w-[200px] lg:py-3 lg:px-3 lg:text-sm"
                onMouseEnter={(e) => showSummaryTooltip(e, lead.summary ?? null)}
                onMouseLeave={hideSummaryTooltip}
              >
                {lead.summary ?? "—"}
              </td>
              <td className="whitespace-nowrap py-2.5 px-2 text-[11px] text-paper-muted lg:py-3 lg:px-3 lg:text-xs">
                {formatDate(lead.fecha)}
              </td>
              <td className="py-2.5 px-2 text-xs text-paper-muted lg:py-3 lg:px-3 lg:text-sm">
                {(() => {
                  const pill = getModalidadPill(lead.modalidad);
                  return (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pill.className}`}
                    >
                      {pill.label}
                    </span>
                  );
                })()}
              </td>
              <td className="whitespace-nowrap py-2.5 px-2 text-[11px] text-paper-muted lg:py-3 lg:px-3 lg:text-xs">
                {formatDate(lead.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {tooltip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[100] max-w-sm -translate-x-1/2 -translate-y-full rounded-lg border border-paper-border bg-white px-3 py-2.5 text-sm text-paper-ink shadow-lg"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
            }}
            role="tooltip"
          >
            <p className="whitespace-pre-wrap break-words">{tooltip.text}</p>
          </div>,
          document.body
        )}
      </div>
    </>
  );
}
