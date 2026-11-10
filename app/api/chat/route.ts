import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { answerChat } from "@/lib/chat/answer";
import { checkWebhookToken } from "@/lib/webhookAuth";

export const dynamic = "force-dynamic";

type ChatPayload = { message?: string; chatInput?: string; sessionId?: string };

// n8n reenvía aquí el mensaje del widget y devuelve { output } al visitante.
export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let payload: ChatPayload;
  try {
    payload = await request.json();
  } catch (error) {
    reportIncident("api/chat", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (payload.message ?? payload.chatInput ?? "").trim();
  const sessionId = (payload.sessionId ?? "").trim();
  if (!text || !sessionId) {
    return NextResponse.json({ error: "Faltan message y sessionId" }, { status: 400 });
  }

  try {
    // Con el sistema apagado, mensaje fijo sin IA y aviso al despacho (ver answerChat).
    const output = await answerChat(sessionId, text);
    return NextResponse.json({ output });
  } catch (error) {
    reportIncident("api/chat", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
