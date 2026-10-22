import { getLeadNotas, type Lead } from "@/lib/db";
import { formatMadrid } from "@/lib/dateFormat";
import { getCallState, getOriginPill, hasAppointment } from "@/lib/leadFilters";
import GestionSelect from "./GestionSelect";
import NotasForm from "./NotasForm";

type Fallback = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Props = {
  lead: Lead | null;
  fallback?: Fallback;
  summaryLabel?: string;
};

const dash = (v: string | null | undefined) => (v && v.trim() ? v : "–");

// Panel de la derecha: datos del usuario, estados, botones de gestión y resumen.
export default async function LeadPanel({ lead, fallback, summaryLabel = "Resumen" }: Props) {
  const notas = lead ? await getLeadNotas(lead.id) : [];
  const name = lead?.name || fallback?.name || null;
  const phone = lead?.phone || fallback?.phone || null;
  const email = lead?.email || fallback?.email || null;
  const call = lead ? getCallState(lead) : { label: "–", description: "Todavía no hay lead.", className: "bg-paper-border text-paper-muted" };

  const rows: [string, string][] = [
    ["Nombre", dash(name)],
    ["Teléfono", dash(phone)],
    ["Email", dash(email)],
    ["Origen", lead ? getOriginPill(lead.source).label : "–"],
    ["Creado", lead ? formatMadrid(lead.created_at) : "–"],
    ["Modalidad", dash(lead?.modalidad)],
    ["Cita", lead && hasAppointment(lead) ? formatMadrid(lead.cita_inicio ?? lead.fecha) : "Sin cita"],
  ];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-paper-muted">Datos del usuario</h2>
        {!lead && <p className="mb-3 text-xs text-paper-muted">Todavía no hay lead. Se crea cuando el asistente agenda una cita o deriva el caso; los datos de abajo son los que ha dado en el chat.</p>}
        <dl className="space-y-2.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3 text-sm">
              <dt className="text-paper-muted">{label}</dt>
              <dd className="max-w-[60%] truncate text-right text-paper-ink" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {lead?.summary && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-paper-muted">{summaryLabel === "Resumen" ? "Motivo indicado" : summaryLabel}</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper-ink">{lead.summary}</p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-paper-muted">Estados</h2>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs text-paper-muted">Llamada (automática)</p>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${call.className}`} title={call.description}>
              {call.label}
            </span>
          </div>
          <div>
            <p className="mb-1 text-xs text-paper-muted">Gestión</p>
            {lead ? (
              <GestionSelect leadId={lead.id} value={lead.gestion_estado} hasAppointment={hasAppointment(lead)} />
            ) : (
              <span className="text-sm text-paper-muted">–</span>
            )}
          </div>
        </div>
      </section>

      {lead && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-paper-muted">Notas del equipo</h2>
          <NotasForm leadId={lead.id} />
          <ul className="mt-4 space-y-3">
            {notas.length === 0 && <li className="text-xs text-paper-muted">Todavía no hay notas.</li>}
            {notas.map((nota) => (
              <li key={nota.id} className="rounded-xl border border-paper-border bg-paper-card px-3 py-2.5">
                <p className="whitespace-pre-wrap text-sm text-paper-ink">{nota.texto}</p>
                <p className="mt-1 text-[11px] text-paper-muted">
                  {nota.autor ?? "Equipo"} · {formatMadrid(nota.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
