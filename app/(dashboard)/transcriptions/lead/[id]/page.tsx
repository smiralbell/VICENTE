import { notFound } from "next/navigation";
import { getLeadById, type Lead } from "@/lib/db";
import { isFormularioSource, isPhoneSource } from "@/lib/leadNavigation";
import LeadPanel from "../../../leads/LeadPanel";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// Lo que ha pasado con las llamadas, dicho de forma clara y profesional.
function callStatusText(lead: Lead): string {
  const attempts = lead.call_attempts ?? 0;
  if (isPhoneSource(lead.source) && lead.status === "contacted") {
    return "La persona llamó al despacho. No hay transcripción disponible para esa llamada.";
  }
  if (lead.status === "contacted") {
    return "Se llamó al usuario y la llamada se realizó, pero no hay transcripción disponible.";
  }
  if (lead.status === "no_answer" || attempts >= 2) {
    return "Se ha llamado al usuario dos veces y no ha contestado.";
  }
  if (lead.status === "retry_pending" || attempts === 1) {
    return "Se ha llamado al usuario una vez y no ha contestado. Se está realizando un segundo intento.";
  }
  if (isFormularioSource(lead.source)) {
    return "Todavía no se ha llamado al usuario.";
  }
  return "No hay transcripción de llamada para este caso.";
}

export default async function LeadCallDetailPage({ params }: Props) {
  const { id } = await params;
  const leadId = parseInt(id, 10);
  if (Number.isNaN(leadId)) notFound();

  const lead = await getLeadById(leadId);
  if (!lead) notFound();

  return (
    <div className="flex h-full min-h-0 flex-1">
      <section
        className="flex min-w-0 flex-1 flex-col bg-paper px-4 pt-4 sm:px-6 md:px-8 md:pt-4"
        aria-label="Llamadas del lead"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl space-y-4 py-6 md:py-8">
            <div className="rounded-xl border border-paper-border bg-paper-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
              <p className="text-xs font-medium uppercase tracking-wider text-paper-muted">Llamadas</p>
              <p className="mt-2 text-[15px] leading-relaxed text-paper-ink">{callStatusText(lead)}</p>
            </div>

            {lead.summary && (
              <div className="rounded-xl border border-paper-border bg-paper-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-paper-muted">
                  Motivo indicado en el formulario
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-paper-ink">{lead.summary}</p>
              </div>
            )}
          </div>
        </div>
      </section>
      <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-paper-border bg-paper-card p-5 xl:block">
        <LeadPanel lead={lead} summaryLabel="Motivo" />
      </aside>
    </div>
  );
}
