import { requireEnv } from "../env";
import { chatCompletion, type ChatMessage } from "../openai";
import { loadHistory, saveTurn } from "./memory";
import { AGENT_SYSTEM_PROMPT } from "./prompt";
import { CHAT_TOOLS, executeTool } from "./tools";

const MAX_STEPS = 5;
const FALLBACK_ANSWER = "Lo siento, no he podido responder en este momento. Inténtelo de nuevo en unos minutos.";

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

function buildSystemPrompt(): string {
  return AGENT_SYSTEM_PROMPT.replace(/\{\{FECHA\}\}/g, spanishNow());
}

export async function runChatTurn(sessionId: string, userText: string): Promise<string> {
  const history = await loadHistory(sessionId);
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
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
