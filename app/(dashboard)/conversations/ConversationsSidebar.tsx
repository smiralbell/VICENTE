"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type SessionWithLeadAndPreview = {
  session_id: string;
  message_count: number;
  last_message_at: Date | null;
  lead: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    session_id: string | null;
    summary: string | null;
    source: string | null;
    created_at: string;
  } | null;
  last_message_preview: string | null;
};

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

  return (
    <div className="flex h-full min-h-0 w-[320px] shrink-0 flex-col border-r border-paper-border">
      <div className="flex min-h-0 flex-1 flex-col pt-10 px-6">
        <div className="shrink-0">
          <form
            method="get"
            action="/conversations"
            className="flex gap-2"
            role="search"
            aria-label="Buscar conversaciones"
          >
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar conversaciones..."
              aria-label="Texto de búsqueda"
              className="min-w-0 flex-1 rounded-md border border-paper-border bg-white px-3 py-2 text-sm text-paper-ink placeholder-paper-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover"
            >
              Buscar
            </button>
          </form>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pt-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-paper-muted">Cargando…</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center text-sm text-paper-muted">
            No hay conversaciones
          </div>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => {
              const href = `/conversations/${encodeURIComponent(s.session_id)}`;
              const isActive = pathname === href;
              const displayName =
                s.lead?.name ?? s.session_id.slice(0, 16) + "…";
              const sub =
                s.lead?.email ??
                s.lead?.phone ??
                "";
              const initial = getInitial(
                s.lead?.name ?? s.session_id.slice(0, 2)
              );

              return (
                <li key={s.session_id}>
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-start gap-3 rounded-lg px-3 py-3 transition-colors ${
                      isActive
                        ? "bg-brand-subtle"
                        : "hover:bg-paper"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                        isActive
                          ? "bg-brand text-white"
                          : "bg-paper-border text-paper-inkLight"
                      }`}
                    >
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          isActive ? "text-brand" : "text-paper-ink"
                        }`}
                      >
                        {displayName}
                      </p>
                      {sub && (
                        <p className="mt-0.5 truncate text-xs text-paper-muted">
                          {sub}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-paper-muted">
                        {s.last_message_preview ??
                          `${s.message_count} mensajes`}
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
