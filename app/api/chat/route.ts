import { NextResponse } from "next/server";
import { runChatTurn } from "@/lib/chat/agent";
import { checkWebhookToken } from "@/lib/webhookAuth";
import { isSystemOn } from "@/lib/availability";

const UNAVAILABLE_MESSAGE =
  "En este momento el asistente no está disponible. Puede contactar con el despacho directamente.";

export const dynamic = "force-dynamic";

type ChatPayload = { message?: string; chatInput?: string; sessionId?: string };

// n8n reenvía aquí el mensaje del widget y devuelve { output } al visitante.
export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let payload: ChatPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (payload.message ?? payload.chatInput ?? "").trim();
  const sessionId = (payload.sessionId ?? "").trim();
  if (!text || !sessionId) {
    return NextResponse.json({ error: "Faltan message y sessionId" }, { status: 400 });
  }

  if (!(await isSystemOn())) {
    return NextResponse.json({ output: UNAVAILABLE_MESSAGE });
  }

  try {
    const output = await runChatTurn(sessionId, text);
    return NextResponse.json({ output });
  } catch {
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
