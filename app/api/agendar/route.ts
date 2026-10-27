import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { runAgendarConsulta } from "@/lib/chat/tools";
import { checkWebhookToken } from "@/lib/webhookAuth";
import { clean, parseRetellTool, resolvePhones, withOtherPhone } from "@/lib/retellTool";

export const dynamic = "force-dynamic";

// Herramienta de agendar consulta para el agente de voz (Retell).
// Acepta los mismos campos que el webhook "Webhook agente de voz" de n8n.
type AgendarArgs = {
  name?: string;
  phone?: string;
  email?: string;
  summaryCase?: string;
  horario?: string;
  consultation_day_time?: string;
  modalidad?: string;
  source?: string;
  // Opcional: si Retell no lo envía, la modificación se detecta después en la transcripción.
  modifica_cita?: boolean | string;
};

export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    reportIncident("api/agendar", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { args, call, callPhone } = parseRetellTool<AgendarArgs>(raw, request);
  // El teléfono de la llamada manda: así el lead siempre tiene teléfono aunque la IA no lo rellene.
  const { phone, otro } = resolvePhones(args.phone, callPhone);
  // Igual que n8n: la sesión del lead es el teléfono normalizado.
  const sessionId = phone || clean(call.call_id);

  try {
    const result = await runAgendarConsulta(
      {
        name: clean(args.name),
        phone,
        email: clean(args.email),
        summaryCase: withOtherPhone(clean(args.summaryCase), otro),
        horario: clean(args.horario) || clean(args.consultation_day_time),
        modalidad: clean(args.modalidad),
        source: clean(args.source) || "Llamada de voz",
        modificaCita: String(args.modifica_cita) === "true",
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
