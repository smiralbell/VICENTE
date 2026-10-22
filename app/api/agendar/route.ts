import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { runAgendarConsulta } from "@/lib/chat/tools";
import { checkWebhookToken } from "@/lib/webhookAuth";
import { validatePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

// Herramienta de agendar consulta para el agente de voz (Retell).
// Acepta los mismos campos que el webhook "Webhook agente de voz" de n8n.
type AgendarBody = {
  name?: string;
  phone?: string;
  email?: string;
  summaryCase?: string;
  horario?: string;
  consultation_day_time?: string;
  modalidad?: string;
  source?: string;
  call?: { call_id?: string; to_number?: string; from_number?: string };
};

export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let body: AgendarBody;
  try {
    body = await request.json();
  } catch (error) {
    reportIncident("api/agendar", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = body.phone || body.call?.from_number || "";
  // Igual que n8n: la sesión del lead es el teléfono normalizado.
  const sessionId = validatePhone(phone).phone || phone || body.call?.call_id || "";

  try {
    const result = await runAgendarConsulta(
      {
        name: body.name ?? "",
        phone,
        email: body.email ?? "",
        summaryCase: body.summaryCase ?? "",
        horario: body.horario ?? body.consultation_day_time ?? "",
        modalidad: body.modalidad ?? "",
        source: body.source || "Llamada de voz",
      },
      sessionId
    );
    return NextResponse.json({ result });
  } catch (error) {
    reportIncident("api/agendar", error);
    return NextResponse.json({ result: "Ha ocurrido un error al agendar la consulta. Pide al usuario que lo intente de nuevo." }, { status: 500 });
  }
}
