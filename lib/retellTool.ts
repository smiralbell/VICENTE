import { validatePhone } from "./phone";

// Petición de una herramienta personalizada del agente de voz (Retell). Llega en uno de estos formatos:
// - «Payload: args only» activado: solo los argumentos que rellena la IA, sin datos de la llamada.
// - Desactivado (recomendado): { name, call, args }, donde call trae los números reales de la llamada.
// También se acepta el teléfono por la URL (?user_number={{user_number}}) por si se prefiere dejar «args only».

export type RetellToolCall = {
  call_id?: string;
  direction?: string;
  from_number?: string;
  to_number?: string;
  retell_llm_dynamic_variables?: Record<string, string | undefined>;
};

type RetellToolBody = { args?: Record<string, unknown>; call?: RetellToolCall } & Record<string, unknown>;

// El agente de voz envía "{{campo}}" cuando una variable no tiene valor: se trata como vacío.
export function clean(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  return /^\{\{.*\}\}$/.test(text) ? "" : text;
}

export function parseRetellTool<T extends Record<string, unknown>>(raw: unknown, request: Request): { args: T; call: RetellToolCall; callPhone: string } {
  const body = (raw && typeof raw === "object" ? raw : {}) as RetellToolBody;
  const args = (body.args && typeof body.args === "object" ? body.args : body) as T;
  const call = (body.call && typeof body.call === "object" ? body.call : {}) as RetellToolCall;
  return { args, call, callPhone: callerPhone(call, new URL(request.url).searchParams.get("user_number")) };
}

// Teléfono del cliente según la llamada: el que llama si es entrante, al que se llama si es saliente.
// Este número lo da Retell, no la IA, así que siempre es el real.
function callerPhone(call: RetellToolCall, fromUrl: string | null): string {
  const byDirection = call.direction === "outbound" ? call.to_number : call.direction === "inbound" ? call.from_number : undefined;
  const candidates = [byDirection, clean(fromUrl), clean(call.retell_llm_dynamic_variables?.phone), call.from_number];
  for (const candidate of candidates) {
    const phone = validatePhone(candidate ?? "");
    if (phone.valid && phone.phone) return phone.phone;
  }
  return "";
}

// Teléfono del lead: el de la llamada (lo da Retell, siempre es el real); si no lo hay, el que ha dicho el cliente.
// Si el cliente ha dado otro número válido distinto, se devuelve aparte para incluirlo en el aviso al despacho.
export function resolvePhones(given: unknown, callPhone: string): { phone: string; otro: string } {
  const said = validatePhone(clean(given));
  const saidPhone = said.valid && said.phone ? said.phone : "";
  const phone = callPhone || saidPhone;
  return { phone, otro: saidPhone && saidPhone !== phone ? saidPhone : "" };
}

export function withOtherPhone(summary: string, otro: string): string {
  return otro ? `${summary}\n\nTeléfono de contacto que ha indicado el cliente: ${otro}` : summary;
}
