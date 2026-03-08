"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useState } from "react";
import type { Lead, LeadSortField } from "@/lib/db";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const COLUMNS: { key: LeadSortField | null; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "email", label: "Email" },
  { key: null, label: "Teléfono" },
  { key: "source", label: "Fuente" },
  { key: null, label: "Resumen" },
  { key: "created_at", label: "Fecha" },
  { key: null, label: "Session ID" },
];

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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]" role="grid">
        <thead>
          <tr className="border-b border-paper-border">
            {COLUMNS.map(({ key, label }, i) => (
              <th
                key={key ?? i}
                className={`py-3 text-left text-xs font-medium tracking-wide text-paper-muted ${
                  label === "Resumen" ? "max-w-[200px] px-4" : "px-4"
                } ${i === COLUMNS.length - 1 ? "pl-4" : ""}`}
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
              <td className="py-3.5 px-4 text-sm font-medium text-paper-ink">
                {lead.name}
              </td>
              <td className="py-3.5 px-4 text-sm text-paper-inkLight">
                {lead.email}
              </td>
              <td className="py-3.5 px-4 text-sm text-paper-inkLight">
                {lead.phone ?? "—"}
              </td>
              <td className="py-3.5 px-4 text-sm text-paper-muted">
                {lead.source ?? "—"}
              </td>
              <td
                className="max-w-[200px] truncate py-3.5 px-4 text-sm text-paper-muted"
                onMouseEnter={(e) => showSummaryTooltip(e, lead.summary ?? null)}
                onMouseLeave={hideSummaryTooltip}
              >
                {lead.summary ?? "—"}
              </td>
              <td className="py-3.5 px-4 text-sm text-paper-muted">
                {formatDate(lead.created_at)}
              </td>
              <td className="py-3.5 pl-4 font-mono text-xs text-paper-muted">
                {lead.session_id
                  ? lead.session_id.length > 12
                    ? `${lead.session_id.slice(0, 12)}…`
                    : lead.session_id
                  : "—"}
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
  );
}
