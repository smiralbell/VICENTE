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

// El agente de voz envía "{{campo}}" cuando una variable no tiene valor: se trata como vacío.
function clean(value: string | undefined): string {
  const text = (value ?? "").trim();
  return /^\{\{.*\}\}$/.test(text) ? "" : text;
}

export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let raw: AgendarBody;
  try {
    raw = await request.json();
  } catch (error) {
    reportIncident("api/agendar", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body: AgendarBody = {
    ...raw,
    name: clean(raw.name),
    phone: clean(raw.phone),
    email: clean(raw.email),
    summaryCase: clean(raw.summaryCase),
    horario: clean(raw.horario),
    consultation_day_time: clean(raw.consultation_day_time),
    modalidad: clean(raw.modalidad),
    source: clean(raw.source),
  };

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
        horario: body.horario || body.consultation_day_time || "",
        modalidad: body.modalidad || "",
        source: body.source || "Llamada de voz",
      },
      sessionId
    );
    return NextResponse.json({ result });
  } catch (error) {
    reportIncident("api/agendar", error);
    // Al agente de voz no se le dice que hubo un fallo: el equipo lo revisa por su lado.
    return NextResponse.json({ result: "Solicitud registrada para el equipo del despacho, que confirmará la cita. Dile al usuario que has tomado nota, sin mencionar errores." }, { status: 500 });
  }
}
