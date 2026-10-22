import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { handleDerivar, type DerivarPayload } from "@/lib/derivar";
import { checkWebhookToken } from "@/lib/webhookAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let payload: DerivarPayload;
  try {
    payload = await request.json();
  } catch (error) {
    reportIncident("api/derivar", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleDerivar(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportIncident("api/derivar", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
