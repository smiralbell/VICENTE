import { reportIncident } from "@/lib/incidents";
import { answerChat } from "@/lib/chat/answer";
import { hasWebhookToken } from "@/lib/webhookAuth";
import { checkWebKey, clientIp, corsHeaders, json, tooMany } from "@/lib/webWebhook";

export const dynamic = "force-dynamic";

type ChatPayload = { message?: string; chatInput?: string; sessionId?: string };

const FALLBACK = "Perdone, ahora mismo no logro formular la respuesta. ¿Podría repetirme su consulta, por favor?";

// Preflight del navegador: el widget de la web llama aquí directamente (sin n8n en medio).
export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// Dos formas de llegar aquí:
// - n8n (flujo agente-chat), desde su servidor, con el token de siempre (WEBHOOK_TOKEN en x-webhook-token o ?token=).
// - El widget de la web, desde el navegador del visitante, con la clave del widget (?key=WEB_WEBHOOK_KEY).
// En los dos casos se responde { output }, que es lo que el widget sabe leer (también lee [{ output }]).
export async function POST(request: Request) {
  const fromN8n = hasWebhookToken(request);
  if (!fromN8n) {
    const denied = checkWebKey(request);
    if (denied) return denied;
  }

  let payload: ChatPayload;
  try {
    payload = await request.json();
  } catch (error) {
    reportIncident("api/chat", error);
    return json(request, { error: "Invalid JSON" }, 400);
  }

  const text = (payload.message ?? payload.chatInput ?? "").trim().slice(0, 2000);
  const sessionId = (payload.sessionId ?? "").trim().slice(0, 200);
  if (!text || !sessionId) {
    return json(request, { error: "Faltan message y sessionId" }, 400);
  }

  // Desde el navegador, cada mensaje cuesta una llamada a OpenAI: límite por conversación y por IP.
  // (Con n8n todo llega desde una sola IP, así que ahí no se limita.) La respuesta lleva texto para que el widget lo muestre.
  if (!fromN8n && (tooMany(`chat:s:${sessionId}`, 20) || tooMany(`chat:ip:${clientIp(request)}`, 120))) {
    return json(request, { output: "Ha enviado muchos mensajes seguidos. Espere un momento y vuelva a escribir, por favor." }, 429);
  }

  try {
    // Con el sistema apagado, mensaje fijo sin IA y aviso al despacho (ver answerChat).
    const output = await answerChat(sessionId, text);
    return json(request, { output });
  } catch (error) {
    reportIncident("api/chat", error);
    // El widget no enseña nada si recibe un error: al visitante se le contesta con un mensaje amable.
    return fromN8n ? json(request, { error: "Processing failed" }, 500) : json(request, { output: FALLBACK });
  }
}
