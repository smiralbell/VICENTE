"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Dropdown from "@/components/Dropdown";
import { GESTION_FILTERS } from "@/lib/leadFilters";

type LeadLite = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  session_id: string | null;
  summary: string | null;
  source: string | null;
  created_at: string;
  status: string | null;
  gestion_estado: string | null;
};

type SessionWithLeadAndPreview = {
  session_id: string;
  message_count: number;
  last_message_at: Date | null;
  lead: LeadLite | null;
  last_message_preview: string | null;
};

const LEAD_FILTERS = [
  { key: "", label: "Todas las conversaciones", className: "" },
  { key: "con_lead", label: "Con lead", className: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
  { key: "sin_lead", label: "Sin lead", className: "bg-paper-border text-paper-muted" },
];

function getInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export default function ConversationsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [sessions, setSessions] = useState<SessionWithLeadAndPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadFilter, setLeadFilter] = useState("");
  const [gestionFilter, setGestionFilter] = useState("");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/conversations?${params.toString()}`);
    const data = await res.json();
    setSessions(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const visible = useMemo(
    () =>
      sessions.filter((s) => {
        if (leadFilter === "con_lead" && !s.lead) return false;
        if (leadFilter === "sin_lead" && s.lead) return false;
        if (gestionFilter && s.lead?.gestion_estado !== gestionFilter) return false;
        return true;
      }),
    [sessions, leadFilter, gestionFilter]
  );

  return (
    <div className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-paper-border md:w-[320px]">
      <div className="flex min-h-0 flex-1 flex-col pt-4 px-4 sm:pt-6 sm:px-5 md:pt-8 md:px-6">
        <div className="shrink-0 space-y-3">
          <form method="get" action="/conversations" className="flex gap-2" role="search" aria-label="Buscar conversaciones">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar conversaciones..."
              aria-label="Texto de búsqueda"
              className="min-w-0 flex-1 rounded-xl border border-paper-border bg-paper-card px-3 py-2 text-sm text-paper-ink placeholder-paper-muted shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </form>

          <div className="flex flex-wrap gap-2">
            <Dropdown label="Filtrar por lead" value={leadFilter} options={LEAD_FILTERS} onChange={setLeadFilter} />
            <Dropdown label="Filtrar por gestión" value={gestionFilter} options={GESTION_FILTERS} onChange={setGestionFilter} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pt-4 md:pt-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-paper-muted">Cargando…</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-12 text-center text-sm text-paper-muted">No hay conversaciones con estos filtros</div>
          ) : (
            <ul className="space-y-1">
              {visible.map((s) => {
                const href = `/conversations/${encodeURIComponent(s.session_id)}`;
                const isActive = pathname === href;
                const displayName = s.lead?.name || s.session_id.slice(0, 16) + "…";
                const sub = s.lead?.email || s.lead?.phone || "";
                const initial = getInitial(s.lead?.name || s.session_id.slice(0, 2));

                return (
                  <li key={s.session_id}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-[56px] items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                        isActive ? "bg-brand-subtle" : "hover:bg-paper active:bg-paper-border"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                          isActive ? "bg-brand text-white" : "bg-paper-border text-paper-inkLight"
                        }`}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${isActive ? "text-brand" : "text-paper-ink"}`}>{displayName}</p>
                        {sub && <p className="mt-0.5 truncate text-xs text-paper-muted">{sub}</p>}
                        <p className="mt-1 line-clamp-2 text-xs leading-snug text-paper-muted">
                          {s.last_message_preview ?? `${s.message_count} mensajes`}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
