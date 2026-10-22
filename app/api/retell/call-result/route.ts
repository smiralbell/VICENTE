import { NextResponse } from "next/server";
import { handleRetellCallEvent, type RetellWebhookPayload } from "@/lib/callFlows";
import { checkWebhookToken } from "@/lib/webhookAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let payload: RetellWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleRetellCallEvent(payload);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
