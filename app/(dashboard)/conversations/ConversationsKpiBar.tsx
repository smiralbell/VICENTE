"use client";

import { useEffect, useState } from "react";

type Session = {
  lead: { gestion_estado: string | null } | null;
};

// Barra superior de KPIs de conversaciones: ocupa todo el ancho, encima del listado, el chat y el panel.
export default function ConversationsKpiBar() {
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, []);

  const withLead = (sessions ?? []).filter((s) => s.lead);
  const cards = [
    { label: "Conversaciones", value: sessions?.length ?? 0, tone: "text-paper-ink", hint: "Todas las conversaciones del asistente web." },
    { label: "Con lead", value: withLead.length, tone: "text-emerald-700", hint: "Conversaciones que ya tienen un lead asociado." },
    { label: "Pendientes de gestionar", value: withLead.filter((s) => s.lead?.gestion_estado === "pendiente").length, tone: "text-slate-700", hint: "Leads que nadie del despacho ha revisado." },
    { label: "Citas por confirmar", value: withLead.filter((s) => s.lead?.gestion_estado === "cita_pendiente").length, tone: "text-sky-700", hint: "Citas agendadas que faltan por confirmar." },
  ];

  return (
    <section aria-label="Resumen de conversaciones" className="grid shrink-0 grid-cols-2 gap-3 border-b border-paper-border bg-paper px-4 pb-4 pt-4 sm:px-6 md:grid-cols-4 md:px-10">
      {cards.map((c) => (
        <div key={c.label} title={c.hint} className="rounded-2xl border border-paper-border bg-paper-card px-4 py-3 shadow-sm">
          <p className="text-xs text-paper-muted">{c.label}</p>
          <p className={`text-xl font-semibold ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </section>
  );
}
