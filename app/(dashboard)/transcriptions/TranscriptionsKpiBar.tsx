"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Dropdown from "@/components/Dropdown";

type Item = { phone: string | null; mail: string | null; fecha: string | null };

const DAY = 24 * 60 * 60 * 1000;

const PERIODOS = [
  { key: "", label: "Todo el periodo", className: "" },
  { key: "hoy", label: "Hoy", className: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
  { key: "7", label: "Últimos 7 días", className: "bg-sky-100 text-sky-800 border border-sky-200" },
  { key: "30", label: "Últimos 30 días", className: "bg-violet-100 text-violet-800 border border-violet-200" },
];

const CONTACTOS = [
  { key: "", label: "Cualquier contacto", className: "" },
  { key: "telefono", label: "Con teléfono", className: "bg-violet-100 text-violet-800 border border-violet-200" },
  { key: "email", label: "Con email", className: "bg-sky-100 text-sky-800 border border-sky-200" },
];

// Barra superior: KPIs y, debajo, una sola fila con buscador y filtros. Los filtros viven en la URL.
export default function TranscriptionsKpiBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[] | null>(null);
  const q = searchParams.get("q") ?? "";
  const periodo = searchParams.get("periodo") ?? "";
  const contacto = searchParams.get("contacto") ?? "";

  useEffect(() => {
    fetch("/api/transcriptions")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  const change = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/transcriptions${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const now = Date.now();
  const d = new Date();
  const startToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const list = items ?? [];
  const cards = [
    { label: "Transcripciones", value: list.length, tone: "text-paper-ink", hint: "Todas las llamadas transcritas." },
    { label: "Hoy", value: list.filter((t) => t.fecha && new Date(t.fecha).getTime() >= startToday).length, tone: "text-emerald-700", hint: "Llamadas de hoy." },
    { label: "Últimos 7 días", value: list.filter((t) => t.fecha && now - new Date(t.fecha).getTime() <= 7 * DAY).length, tone: "text-sky-700", hint: "Llamadas de la última semana." },
    { label: "Con teléfono", value: list.filter((t) => t.phone).length, tone: "text-violet-700", hint: "Transcripciones con número de teléfono." },
  ];

  return (
    <section aria-label="Resumen de transcripciones" className="shrink-0 border-b border-paper-border bg-paper px-4 pb-4 pt-4 sm:px-6 md:px-10">
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
        aria-label="Buscar transcripciones"
        onSubmit={(e) => {
          e.preventDefault();
          const value = (new FormData(e.currentTarget).get("q") as string) ?? "";
          change({ q: value.trim() });
        }}
      >
        <Dropdown label="Filtrar por periodo" value={periodo} options={PERIODOS} onChange={(v) => change({ periodo: v })} />
        <Dropdown label="Filtrar por contacto" value={contacto} options={CONTACTOS} onChange={(v) => change({ contacto: v })} />
        <input
          type="search"
          name="q"
          key={q}
          defaultValue={q}
          placeholder="Buscar por nombre, teléfono o email…"
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
