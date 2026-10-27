import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { handleInboundCall, type InboundPayload } from "@/lib/callFlows";
import { checkWebhookToken } from "@/lib/webhookAuth";

export const dynamic = "force-dynamic";

// Webhook de llamada entrante de Retell. Con cualquier error (4xx/5xx o sin respuesta) Retell reintenta y después
// atiende IGUAL con la IA, pero sin variables, y el agente ve «{{name}}» o «{{phone}}» sin sustituir.
// Por eso aquí nunca se devuelve un error: como mínimo van las variables vacías y el número de quien llama.
// (Para que Retell cuelgue habría que devolver { call_inbound: { reject: true } } con estado 200.)

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

  // Las llamadas entrantes las atiende siempre la IA, aunque el sistema esté apagado o en «solo fuera de horario»:
  // si una llamada llega a Retell es porque nadie la ha cogido en el despacho, y colgar haría perder al cliente.
  // Los interruptores del Dashboard siguen controlando las llamadas salientes.
  try {
    return NextResponse.json(await handleInboundCall(payload));
  } catch (error) {
    reportIncident("retell/inbound", error);
    // Si falla la base de datos, el agente atiende al menos con el número de quien llama.
    return NextResponse.json(emptyVariables(fromNumber));
  }
}
