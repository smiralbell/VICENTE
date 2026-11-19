// Stub de lib/openai.ts para las pruebas: no llama a OpenAI, devuelve la respuesta falsa que fije la prueba.
export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
};

let nextReply: string | null = "{}";
export const sentMessages: ChatMessage[][] = [];

export function setNextReply(content: string | null): void {
  nextReply = content;
}

export function resetMessages(): void {
  sentMessages.length = 0;
}

export async function chatCompletion(model: string, messages: ChatMessage[]): Promise<ChatMessage> {
  sentMessages.push(messages);
  return { role: "assistant", content: nextReply };
}
