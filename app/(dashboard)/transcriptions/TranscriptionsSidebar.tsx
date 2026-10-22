"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type TranscriptionItem = {
  id: number;
  transcription: string | null;
  phone: string | null;
  name: string | null;
  mail: string | null;
  summary?: string | null;
  fecha: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

function withinPeriod(fecha: string | null, periodo: string): boolean {
  if (!periodo) return true;
  if (!fecha) return false;
  const t = new Date(fecha).getTime();
  if (Number.isNaN(t)) return false;
  if (periodo === "hoy") {
    const d = new Date();
    return t >= new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  return Date.now() - t <= Number(periodo) * DAY;
}

// Listado de transcripciones. Buscador y filtros están en la barra superior y se leen de la URL.
export default function TranscriptionsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const periodo = searchParams.get("periodo") ?? "";
  const contacto = searchParams.get("contacto") ?? "";
  const [items, setItems] = useState<TranscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/transcriptions?${params.toString()}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const visible = useMemo(
    () =>
      items.filter((t) => {
        if (!withinPeriod(t.fecha, periodo)) return false;
        if (contacto === "telefono" && !t.phone) return false;
        if (contacto === "email" && !t.mail) return false;
        return true;
      }),
    [items, periodo, contacto]
  );

  return (
    <div className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-paper-border md:w-[320px]">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-paper-muted">Cargando…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-sm text-paper-muted">No hay transcripciones con estos filtros</div>
        ) : (
          <ul className="space-y-1">
            {visible.map((t) => {
              const href = `/transcriptions/${t.id}`;
              const isActive = pathname === href;
              const title = t.name || t.phone || t.mail || `Transcripción #${t.id}`;
              const subtitle = t.phone || t.mail || "";
              const preview = t.transcription && t.transcription.length > 80 ? t.transcription.slice(0, 80) + "…" : t.transcription;
              return (
                <li key={t.id}>
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
                      {(t.name || t.phone || "?").toString().trim().slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${isActive ? "text-brand" : "text-paper-ink"}`}>{title}</p>
                      {subtitle && <p className="mt-0.5 truncate text-xs text-paper-muted">{subtitle}</p>}
                      {t.summary && <p className="mt-1 truncate text-xs text-paper-inkLight">Motivo: {t.summary}</p>}
                      {preview && <p className="mt-1 line-clamp-2 text-xs leading-snug text-paper-muted">{preview}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
