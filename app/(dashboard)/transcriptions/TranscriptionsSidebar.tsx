"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Dropdown from "@/components/Dropdown";

type TranscriptionItem = {
  id: number;
  transcription: string | null;
  phone: string | null;
  name: string | null;
  mail: string | null;
  fecha: string | null;
};

const PERIODOS = [
  { key: "", label: "Todo el periodo", dot: "" },
  { key: "hoy", label: "Hoy", dot: "bg-emerald-500" },
  { key: "7", label: "Últimos 7 días", dot: "bg-sky-500" },
  { key: "30", label: "Últimos 30 días", dot: "bg-violet-500" },
];

const DAY = 24 * 60 * 60 * 1000;

function withinPeriod(fecha: string | null, periodo: string): boolean {
  if (!periodo) return true;
  if (!fecha) return false;
  const t = new Date(fecha).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  if (periodo === "hoy") {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return t >= start;
  }
  return now - t <= Number(periodo) * DAY;
}

export default function TranscriptionsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [items, setItems] = useState<TranscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("");
  const [contacto, setContacto] = useState("");

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

  const kpis = useMemo(() => {
    const semana = items.filter((t) => withinPeriod(t.fecha, "7")).length;
    const hoy = items.filter((t) => withinPeriod(t.fecha, "hoy")).length;
    return {
      total: items.length,
      semana,
      hoy,
      conTelefono: items.filter((t) => t.phone).length,
    };
  }, [items]);

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

  const cards = [
    { label: "Transcripciones", value: kpis.total, tone: "text-paper-ink" },
    { label: "Hoy", value: kpis.hoy, tone: "text-emerald-700" },
    { label: "Últimos 7 días", value: kpis.semana, tone: "text-sky-700" },
    { label: "Con teléfono", value: kpis.conTelefono, tone: "text-violet-700" },
  ];

  return (
    <div className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-paper-border md:w-[320px]">
      <div className="flex min-h-0 flex-1 flex-col pt-4 px-4 sm:pt-6 sm:px-5 md:pt-8 md:px-6">
        <div className="shrink-0 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-paper-border bg-paper-card px-3 py-2 shadow-sm">
                <p className="text-[11px] text-paper-muted">{c.label}</p>
                <p className={`text-lg font-semibold ${c.tone}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <form method="get" action="/transcriptions" className="flex gap-2" role="search" aria-label="Buscar transcripciones">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Nombre, teléfono o email..."
              aria-label="Texto de búsqueda"
              className="min-w-0 flex-1 rounded-xl border border-paper-border bg-paper-card px-3 py-2 text-sm text-paper-ink placeholder-paper-muted shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </form>

          <div className="flex flex-wrap gap-2">
            <Dropdown label="Filtrar por periodo" value={periodo} options={PERIODOS} onChange={setPeriodo} />
            <Dropdown
              label="Filtrar por contacto"
              value={contacto}
              options={[
                { key: "", label: "Cualquier contacto", dot: "" },
                { key: "telefono", label: "Con teléfono", dot: "bg-violet-500" },
                { key: "email", label: "Con email", dot: "bg-sky-500" },
              ]}
              onChange={setContacto}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pt-4 md:pt-5">
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
    </div>
  );
}
