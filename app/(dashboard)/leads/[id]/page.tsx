import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const leadId = parseInt(id, 10);
  if (Number.isNaN(leadId)) notFound();

  const lead = await getLeadById(leadId);
  if (!lead) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href="/leads"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm text-paper-muted hover:text-brand focus:outline-none focus:underline"
      >
        ← Volver a leads
      </Link>

      <div className="mt-8 border-t border-paper-border pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-serif text-xl font-medium text-paper-ink">
            {lead.name}
          </h1>
          <span className="text-xs text-paper-muted">
            {formatDate(lead.created_at)}
          </span>
        </div>

        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
              Email
            </dt>
            <dd className="mt-0.5 text-sm text-paper-ink">{lead.email}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
              Teléfono
            </dt>
            <dd className="mt-0.5 text-sm text-paper-ink">
              {lead.phone ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
              Fuente
            </dt>
            <dd className="mt-0.5 text-sm text-paper-ink">
              {lead.source ?? "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
              Session ID
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-paper-inkLight break-all">
              {lead.session_id ?? "—"}
            </dd>
          </div>
          {lead.summary && (
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-paper-muted">
                Resumen
              </dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-paper-ink whitespace-pre-wrap">
                {lead.summary}
              </dd>
            </div>
          )}
        </dl>

        {lead.session_id && (
          <div className="mt-8 pt-6 border-t border-paper-border">
            <Link
              href={`/conversations/${encodeURIComponent(lead.session_id)}`}
              className="inline-flex min-h-[48px] items-center rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
            >
              Ver conversación
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
