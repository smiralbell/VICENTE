import type { LeadKpis } from "@/lib/db";

type Props = {
  kpis: LeadKpis;
};

export default function LeadsKpis({ kpis }: Props) {
  const cards = [
    { label: "Total leads", value: kpis.total, accent: "text-paper-ink" },
    { label: "Pendientes", value: kpis.pending, accent: "text-amber-700" },
    { label: "Con reunión", value: kpis.withMeeting, accent: "text-brand" },
    { label: "Presencial", value: kpis.presencial, accent: "text-violet-700" },
    { label: "No presencial", value: kpis.noPresencial, accent: "text-sky-700" },
  ];

  return (
    <section
      aria-label="Resumen de leads"
      className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5"
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-paper-border bg-paper-card p-4 shadow-sm"
        >
          <p className="text-xs font-medium text-paper-muted">{card.label}</p>
          <p className={`mt-1 text-2xl font-semibold ${card.accent}`}>{card.value}</p>
        </div>
      ))}
    </section>
  );
}
