import { isSystemOn } from "../availability";
import { reportIncident } from "../incidents";
import { runChatTurn } from "./agent";
import { handleOfflineChat, OFFLINE_ASK } from "./offline";

// Respuesta del chat a un mensaje del widget. La usan /api/chat (vía n8n) y /api/web/chat (directo desde la web).
// Con el sistema apagado contesta un mensaje fijo sin IA y avisa al despacho; si eso falla, al menos el mensaje fijo.
// Si falla la IA, lanza el error: cada ruta decide qué devolver.
export async function answerChat(sessionId: string, text: string): Promise<string> {
  if (!(await isSystemOn())) {
    try {
      return await handleOfflineChat(sessionId, text);
    } catch (error) {
      reportIncident("chat/answer", error);
      return OFFLINE_ASK;
    }
  }
  return runChatTurn(sessionId, text);
}
