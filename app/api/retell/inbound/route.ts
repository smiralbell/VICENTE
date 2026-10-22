import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { handleInboundCall, type InboundPayload } from "@/lib/callFlows";
import { checkWebhookToken } from "@/lib/webhookAuth";
import { isAiAvailable } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let payload: InboundPayload;
  try {
    payload = await request.json();
  } catch (error) {
    reportIncident("retell/inbound", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!(await isAiAvailable())) {
    return NextResponse.json({ error: "Sistema desactivado" }, { status: 503 });
  }

  try {
    const response = await handleInboundCall(payload);
    return NextResponse.json(response);
  } catch (error) {
    reportIncident("retell/inbound", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
