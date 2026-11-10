import { reportIncident } from "@/lib/incidents";
import { answerChat } from "@/lib/chat/answer";
import { checkWebKey, clientIp, corsHeaders, field, json, tooMany } from "@/lib/webWebhook";

export const dynamic = "force-dynamic";

const FALLBACK = "Perdone, ahora mismo no logro formular la respuesta. ¿Podría repetirme su consulta, por favor?";

// Widget de chat de la web, directo (sustituye al flujo agente-chat de n8n).
// Recibe { message, sessionId } y devuelve [{ output }], lo mismo que devolvía n8n, para no tocar el widget.
export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const denied = checkWebKey(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: "Invalid JSON" }, 400);
  }

  const text = field(body.message ?? body.chatInput, 4000);
  const sessionId = field(body.sessionId, 200);
  if (!text || !sessionId) return json(request, { error: "Faltan message y sessionId" }, 400);

  // Cada mensaje cuesta una llamada a OpenAI: límite por conversación y por IP.
  if (tooMany(`chat:s:${sessionId}`, 20) || tooMany(`chat:ip:${clientIp(request)}`, 120)) {
    return json(request, [{ output: "Ha enviado muchos mensajes seguidos. Espere un momento y vuelva a escribir, por favor." }], 429);
  }

  try {
    return json(request, [{ output: await answerChat(sessionId, text) }]);
  } catch (error) {
    reportIncident("api/web/chat", error);
    return json(request, [{ output: FALLBACK }]);
  }
}
