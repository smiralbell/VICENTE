import { query } from "../db";
import type { ChatMessage } from "../openai";

const CHAT_TABLE = "eliasymunozabogados_chat_histories";
// Igual que en n8n: los últimos 20 mensajes de la sesión.
const CONTEXT_WINDOW = 20;

type StoredMessage = { type: "human" | "ai"; content: string };

export async function loadHistory(sessionId: string): Promise<ChatMessage[]> {
  const { rows } = await query<{ message: StoredMessage }>(
    `SELECT message FROM ${CHAT_TABLE} WHERE session_id = $1 ORDER BY id DESC LIMIT $2`,
    [sessionId, CONTEXT_WINDOW]
  );

  return rows
    .reverse()
    .filter((row) => typeof row.message?.content === "string")
    .map((row) => ({
      role: row.message.type === "human" ? "user" : "assistant",
      content: row.message.content,
    }));
}

export async function saveTurn(sessionId: string, userText: string, aiText: string): Promise<void> {
  const human: StoredMessage & Record<string, unknown> = {
    type: "human",
    content: userText,
    additional_kwargs: {},
    response_metadata: {},
  };
  const ai: StoredMessage & Record<string, unknown> = {
    type: "ai",
    content: aiText,
    tool_calls: [],
    additional_kwargs: {},
    response_metadata: {},
  };

  await query(`INSERT INTO ${CHAT_TABLE} (session_id, message) VALUES ($1, $2), ($1, $3)`, [
    sessionId,
    JSON.stringify(human),
    JSON.stringify(ai),
  ]);
}
