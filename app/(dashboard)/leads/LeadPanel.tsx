import type { Lead } from "@/lib/db";
import { formatMadrid } from "@/lib/dateFormat";
import { getCallState, getOriginPill, getStatusPill, hasAppointment } from "@/lib/leadFilters";
import GestionSelect from "./GestionSelect";

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
export default function LeadPanel({ lead, fallback, summaryLabel = "Resumen" }: Props) {
  const name = lead?.name || fallback?.name || null;
  const phone = lead?.phone || fallback?.phone || null;
  const email = lead?.email || fallback?.email || null;
  const call = lead ? getCallState(lead) : getStatusPill(null);

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
        {!lead && <p className="mb-3 text-xs text-paper-muted">No hay un lead asociado a esta conversación.</p>}
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

    </div>
  );
}
