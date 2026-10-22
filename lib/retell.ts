import { requireEnv } from "./env";

const RETELL_API_BASE = "https://api.retellai.com";

export type CreatePhoneCallInput = {
  fromNumber: string;
  toNumber: string;
  agentId: string;
  dynamicVariables: Record<string, string>;
};

export async function createPhoneCall(input: CreatePhoneCallInput): Promise<unknown> {
  const apiKey = requireEnv("RETELL_API_KEY");

  const res = await fetch(`${RETELL_API_BASE}/v2/create-phone-call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_number: input.fromNumber,
      to_number: input.toNumber,
      agent_id: input.agentId,
      retell_llm_dynamic_variables: input.dynamicVariables,
    }),
  });

  if (!res.ok) {
    throw new Error(`Retell create-phone-call respondió ${res.status}`);
  }
  return res.json();
}
