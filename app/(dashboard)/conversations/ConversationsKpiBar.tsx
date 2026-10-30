"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Dropdown from "@/components/Dropdown";
import { GESTION_FILTERS } from "@/lib/leadFilters";
import DateRangeFilter, { useSharedRange } from "@/components/DateRangeFilter";
import { inRange } from "@/lib/dateRange";

type Session = {
  lead: { gestion_estado: string | null } | null;
  last_message_at: string | null;
};

const LEAD_FILTERS = [
  { key: "", label: "Todas las conversaciones", className: "" },
  { key: "con_lead", label: "Con lead", className: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
  { key: "sin_lead", label: "Sin lead", className: "bg-paper-border text-paper-muted" },
];

// Barra superior: KPIs y, debajo, una sola fila con buscador y filtros. Los filtros viven en la URL.
export default function ConversationsKpiBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const q = searchParams.get("q") ?? "";
  const lead = searchParams.get("lead") ?? "";
  const gestion = searchParams.get("gestion") ?? "";
  const range = useSharedRange();

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, []);

  const change = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/conversations${params.toString() ? `?${params.toString()}` : ""}`);
  };

  // Las cifras siguen el rango de fechas, igual que el listado.
  const inPeriod = (sessions ?? []).filter((s) => inRange(s.last_message_at, range));
  const withLead = inPeriod.filter((s) => s.lead);
  const cards = [
    { label: "Conversaciones", value: inPeriod.length, tone: "text-paper-ink", hint: "Todas las conversaciones del asistente web." },
    { label: "Con lead", value: withLead.length, tone: "text-emerald-700", hint: "Conversaciones que ya tienen un lead asociado." },
    { label: "Pendientes de gestionar", value: withLead.filter((s) => s.lead?.gestion_estado === "pendiente").length, tone: "text-slate-700", hint: "Leads que nadie del despacho ha revisado." },
    { label: "Citas por confirmar", value: withLead.filter((s) => s.lead?.gestion_estado === "cita_pendiente").length, tone: "text-sky-700", hint: "Citas agendadas que faltan por confirmar." },
  ];

  return (
    <section aria-label="Resumen de conversaciones" className="shrink-0 border-b border-paper-border bg-paper px-4 pb-4 pt-4 sm:px-6 md:px-10">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} title={c.hint} className="rounded-2xl border border-paper-border bg-paper-card px-4 py-3 shadow-sm">
            <p className="text-xs text-paper-muted">{c.label}</p>
            <p className={`text-xl font-semibold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Buscar conversaciones"
        onSubmit={(e) => {
          e.preventDefault();
          const value = (new FormData(e.currentTarget).get("q") as string) ?? "";
          change({ q: value.trim() });
        }}
      >
        <Dropdown label="Filtrar por lead" value={lead} options={LEAD_FILTERS} onChange={(v) => change({ lead: v })} />
        <Dropdown label="Filtrar por gestión" value={gestion} options={GESTION_FILTERS} onChange={(v) => change({ gestion: v })} />
        <DateRangeFilter range={range} />
        <input
          type="search"
          name="q"
          key={q}
          defaultValue={q}
          placeholder="Buscar por nombre, email o teléfono…"
          aria-label="Texto de búsqueda"
          className="h-11 min-w-[200px] flex-1 rounded-xl border border-paper-border bg-paper-card px-4 text-sm text-paper-ink placeholder-paper-muted shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button type="submit" className="h-11 shrink-0 rounded-xl bg-brand px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-hover">
          Buscar
        </button>
      </form>
    </section>
  );
}
