import { requireEnv } from "./env";
import { recordUsage } from "./usage";

const OPENAI_BASE = "https://api.openai.com/v1";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export type ToolDefinition = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

async function openaiPost<T>(path: string, body: unknown): Promise<T> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const res = await fetch(`${OPENAI_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${path} respondió ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  tools?: ToolDefinition[]
): Promise<ChatMessage> {
  const data = await openaiPost<{
    choices: { message: ChatMessage }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  }>("/chat/completions", {
    model,
    messages,
    ...(tools && tools.length ? { tools, tool_choice: "auto" } : {}),
  });
  await recordUsage(model, data.usage?.prompt_tokens ?? 0, data.usage?.completion_tokens ?? 0);
  return data.choices[0].message;
}

export async function createEmbedding(input: string, model: string): Promise<number[]> {
  const data = await openaiPost<{ data: { embedding: number[] }[]; usage?: { prompt_tokens?: number } }>("/embeddings", {
    model,
    input,
  });
  await recordUsage(model, data.usage?.prompt_tokens ?? 0, 0);
  return data.data[0].embedding;
}
