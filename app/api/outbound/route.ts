import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { handleOutbound, type OutboundPayload } from "@/lib/outbound";
import { checkWebhookToken } from "@/lib/webhookAuth";

export const dynamic = "force-dynamic";

// n8n reenvía aquí los formularios web (name, phone, email, summaryCase).
export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let payload: OutboundPayload & { message?: string };
  try {
    payload = await request.json();
  } catch (error) {
    reportIncident("api/outbound", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const status = await handleOutbound({
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      summaryCase: payload.summaryCase ?? payload.message,
    });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    reportIncident("api/outbound", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
