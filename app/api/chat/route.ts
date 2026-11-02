import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { runChatTurn } from "@/lib/chat/agent";
import { checkWebhookToken } from "@/lib/webhookAuth";
import { isSystemOn } from "@/lib/availability";
import { handleOfflineChat, OFFLINE_ASK } from "@/lib/chat/offline";

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

  // Sistema apagado: mensaje fijo, sin IA, y aviso al despacho. Si algo falla, al menos el mensaje fijo.
  if (!(await isSystemOn())) {
    try {
      return NextResponse.json({ output: await handleOfflineChat(sessionId, text) });
    } catch (error) {
      reportIncident("api/chat", error);
      return NextResponse.json({ output: OFFLINE_ASK });
    }
  }

  try {
    const output = await runChatTurn(sessionId, text);
    return NextResponse.json({ output });
  } catch (error) {
    reportIncident("api/chat", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
