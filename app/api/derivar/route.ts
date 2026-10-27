import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { handleDerivar } from "@/lib/derivar";
import { checkWebhookToken } from "@/lib/webhookAuth";
import { clean, parseRetellTool, resolvePhones, withOtherPhone } from "@/lib/retellTool";

export const dynamic = "force-dynamic";

// Herramienta de derivar a un abogado para el agente de voz (Retell).
type DerivarArgs = {
  lawyerName?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  summaryCase?: string;
  sessionId?: string;
  source?: string;
};

export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    reportIncident("api/derivar", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { args, call, callPhone } = parseRetellTool<DerivarArgs>(raw, request);
  // El teléfono de la llamada manda: así el correo siempre lleva teléfono aunque la IA no lo rellene.
  const { phone, otro } = resolvePhones(args.clientPhone, callPhone);
  if (!phone) {
    // Sin teléfono el despacho no puede contactar: se registra para revisarlo y se pide el número al cliente.
    reportIncident("api/derivar", new Error("Derivación sin teléfono: Retell no envió los datos de la llamada y la IA no dio un teléfono válido"), {
      call_id: clean(call.call_id),
      clientPhone: clean(args.clientPhone),
    });
    return NextResponse.json({ result: "Falta un teléfono de contacto válido. Pídelo de forma natural, por ejemplo: «¿Me indica un teléfono de contacto, por favor?», y vuelve a derivar el caso. No hables de formatos ni de fallos." });
  }

  try {
    await handleDerivar({
      lawyerName: clean(args.lawyerName),
      clientName: clean(args.clientName),
      clientPhone: phone,
      clientEmail: clean(args.clientEmail),
      summaryCase: withOtherPhone(clean(args.summaryCase), otro),
      // La sesión del lead de voz es su teléfono, igual que al agendar.
      sessionId: phone,
      source: clean(args.source) || "Llamada de voz",
    });
    return NextResponse.json({ ok: true, result: "Caso derivado al despacho. Se ha avisado al abogado y el cliente será contactado." });
  } catch (error) {
    reportIncident("api/derivar", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
