import type { LeadKpis } from "@/lib/db";

type Props = {
  kpis: LeadKpis;
  // Con un rango de fechas elegido, las cifras son solo de los leads creados en ese rango.
  filtered?: boolean;
};

// Cada tarjeta explica qué cuenta, para que el equipo sepa qué significa.
export default function LeadsKpis({ kpis, filtered = false }: Props) {
  const cards = [
    { label: filtered ? "Leads en el periodo" : "Total leads", value: kpis.total, hint: filtered ? "Leads creados en las fechas elegidas." : "Todos los leads guardados.", accent: "text-paper-ink" },
    { label: "Sin llamar", value: kpis.sinLlamar, hint: "Aún no los ha llamado el agente de voz.", accent: "text-amber-700" },
    { label: "Pendientes de gestionar", value: kpis.pendientesGestion, hint: "Nadie del despacho los ha revisado.", accent: "text-slate-700" },
    { label: "Citas por confirmar", value: kpis.citasPendientes, hint: "El agente agendó y falta confirmar.", accent: "text-sky-700" },
    { label: "Citas confirmadas", value: kpis.citasConfirmadas, hint: "Un abogado ya las ha confirmado.", accent: "text-emerald-700" },
    { label: "Derivados", value: kpis.derivados, hint: "Casos que lleva un abogado concreto.", accent: "text-violet-700" },
  ];

  return (
    <section aria-label="Resumen de leads" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          title={card.hint}
          className="rounded-2xl border border-paper-border bg-paper-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-medium text-paper-muted">{card.label}</p>
          <p className={`mt-1 text-2xl font-semibold ${card.accent}`}>{card.value}</p>
        </div>
      ))}
    </section>
  );
}
