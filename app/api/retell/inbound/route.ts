import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { handleInboundCall, handleUnattendedInbound, type InboundPayload } from "@/lib/callFlows";
import { checkWebhookToken } from "@/lib/webhookAuth";
import { getDashboardSettings } from "@/lib/db";
import { isWorkingHours } from "@/lib/availability";
import type { MotivoAviso } from "@/lib/avisos";

export const dynamic = "force-dynamic";

// Webhook de llamada entrante de Retell. Con cualquier error (4xx/5xx o sin respuesta) Retell reintenta y después
// atiende IGUAL con la IA, pero sin variables, y el agente ve «{{name}}» o «{{phone}}» sin sustituir.
// Por eso aquí nunca se devuelve un error: como mínimo van las variables vacías y el número de quien llama.
// Para que Retell no conteste se devuelve { call_inbound: { reject: true } } con estado 200.

// Por qué la IA no debe coger la llamada ahora (o null si debe cogerla). Si no se pueden leer los ajustes, atiende.
async function unattendedReason(): Promise<MotivoAviso | null> {
  const settings = await getDashboardSettings();
  if (!settings.systemPublished) return "sistema_apagado";
  if (settings.offWorkOnly && isWorkingHours()) return "horario_laboral";
  return null;
}

// Variables vacías pero definidas: así el agente nunca ve un marcador sin sustituir.
function emptyVariables(phone: string) {
  return { call_inbound: { dynamic_variables: { name: "", phone, email: "", summaryCase: "" } } };
}

export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let payload: InboundPayload;
  try {
    payload = await request.json();
  } catch (error) {
    reportIncident("retell/inbound", error);
    return NextResponse.json(emptyVariables(""));
  }
  const fromNumber = payload.call_inbound?.from_number ?? "";

  // La IA no coge la llamada con el sistema apagado, ni en horario laboral con el modo «solo fuera de horario».
  // Se responde al momento (Retell espera como mucho 10 s y, si no, atiende igual) y el aviso al despacho se envía después.
  const motivo = await unattendedReason();
  if (motivo) {
    handleUnattendedInbound(payload, motivo).catch((error) => reportIncident("retell/inbound", error));
    return NextResponse.json({ call_inbound: { reject: true } });
  }

  try {
    return NextResponse.json(await handleInboundCall(payload));
  } catch (error) {
    reportIncident("retell/inbound", error);
    // Si falla la base de datos, el agente atiende al menos con el número de quien llama.
    return NextResponse.json(emptyVariables(fromNumber));
  }
}
