import { requireEnv } from "../env";
import { chatCompletion, type ChatMessage } from "../openai";
import { loadHistory, saveTurn } from "./memory";
import { AGENT_SYSTEM_PROMPT } from "./prompt";
import { CHAT_TOOLS, executeTool } from "./tools";
import { describeChatDatos, extractDatos, getChatDatos, saveChatDatos } from "./datos";

const MAX_STEPS = 5;
const FALLBACK_ANSWER = "Perdone, ahora mismo no logro formular la respuesta. ¿Podría repetirme su consulta, por favor?";

// Fecha en español y zona horaria de Madrid, como el "$now" de n8n.
function spanishNow(): string {
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} de ${get("month")} y son las ${get("hour")}:${get("minute")}`;
}

// Próximos 14 días con su fecha exacta, para no inventar el día de la semana ni el número.
function nextDaysReference(): string {
  const format = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    days.push(format.format(new Date(Date.now() + i * 24 * 60 * 60 * 1000)));
  }
  return days.join("; ");
}

function buildSystemPrompt(datosCliente: string): string {
  const prompt = AGENT_SYSTEM_PROMPT.replace(/\{\{FECHA\}\}/g, spanishNow());
  return `${prompt}\n\n${datosCliente}\n\nCalendario de referencia (use estas fechas exactas al registrar una cita): ${nextDaysReference()}.`;
}

export async function runChatTurn(sessionId: string, userText: string): Promise<string> {
  const history = await loadHistory(sessionId);
  // Lo que el cliente acaba de dar se guarda antes de contestar, para que el asistente ya lo tenga.
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const found = extractDatos(userText, typeof lastAssistant === "string" ? lastAssistant : "");
  if (Object.values(found).some(Boolean)) await saveChatDatos(sessionId, found);
  const datosCliente = describeChatDatos(await getChatDatos(sessionId));
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(datosCliente) },
    ...history,
    { role: "user", content: userText },
  ];

  let answer = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const message = await chatCompletion(requireEnv("OPENAI_CHAT_MODEL"), messages, CHAT_TOOLS);

    if (message.tool_calls && message.tool_calls.length > 0) {
      messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });
      for (const call of message.tool_calls) {
        const result = await executeTool(call.function.name, call.function.arguments, sessionId);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
      continue;
    }

    answer = message.content ?? "";
    break;
  }

  if (!answer) answer = FALLBACK_ANSWER;

  await saveTurn(sessionId, userText, answer);
  return answer;
}
