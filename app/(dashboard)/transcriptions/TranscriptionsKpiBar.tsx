"use client";

import { useEffect, useState } from "react";

type Item = { phone: string | null; mail: string | null; fecha: string | null };

const DAY = 24 * 60 * 60 * 1000;

// Barra superior de KPIs de transcripciones: ocupa todo el ancho, encima del listado, la transcripción y el panel.
export default function TranscriptionsKpiBar() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    fetch("/api/transcriptions")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

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
    <section aria-label="Resumen de transcripciones" className="grid shrink-0 grid-cols-2 gap-3 border-b border-paper-border bg-paper px-4 pb-4 pt-4 sm:px-6 md:grid-cols-4 md:px-10">
      {cards.map((c) => (
        <div key={c.label} title={c.hint} className="rounded-2xl border border-paper-border bg-paper-card px-4 py-3 shadow-sm">
          <p className="text-xs text-paper-muted">{c.label}</p>
          <p className={`text-xl font-semibold ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </section>
  );
}
