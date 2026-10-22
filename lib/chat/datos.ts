import { query } from "../db";
import { validatePhone } from "../phone";

const DATOS_TABLE = "eliasymunozabogados_chat_datos";

export type ChatDatos = {
  name: string;
  phone: string;
  email: string;
  motivo: string;
};

const EMPTY: ChatDatos = { name: "", phone: "", email: "", motivo: "" };

export async function getChatDatos(sessionId: string): Promise<ChatDatos> {
  const { rows } = await query<ChatDatos>(
    `SELECT name, phone, email, motivo FROM ${DATOS_TABLE} WHERE session_id = $1`,
    [sessionId]
  );
  return rows[0] ?? EMPTY;
}

// Guarda solo los campos que llegan con texto: un valor vacío nunca borra lo que ya se sabe.
export async function saveChatDatos(sessionId: string, datos: Partial<ChatDatos>): Promise<void> {
  await query(
    `INSERT INTO ${DATOS_TABLE} (session_id, name, phone, email, motivo)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id) DO UPDATE SET
       name = COALESCE(NULLIF(EXCLUDED.name, ''), ${DATOS_TABLE}.name),
       phone = COALESCE(NULLIF(EXCLUDED.phone, ''), ${DATOS_TABLE}.phone),
       email = COALESCE(NULLIF(EXCLUDED.email, ''), ${DATOS_TABLE}.email),
       motivo = COALESCE(NULLIF(EXCLUDED.motivo, ''), ${DATOS_TABLE}.motivo),
       updated_at = NOW()`,
    [sessionId, datos.name?.trim() ?? "", datos.phone?.trim() ?? "", datos.email?.trim() ?? "", datos.motivo?.trim() ?? ""]
  );
}

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_PATTERN = /\+?\d[\d\s.-]{7,}\d/;
const LETTERS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-";
const NAME_PREFIX_PATTERN = new RegExp(`(?:me llamo|mi nombre es)\\s+([${LETTERS}]+(?:\\s+[${LETTERS}]+){0,3})`, "i");
const NOT_A_NAME = /\b(no|si|sí|hola|gracias|vale|ok|quiero|pues|bueno|buenas|buenos|tengo|necesito)\b/i;
const NAME_ANSWER_PATTERN = new RegExp(`^\\s*([${LETTERS}]+(?:\\s+[${LETTERS}]+){0,3})\\s*[.!]?\\s*$`);

// Captura lo que el cliente da de forma explícita, sin depender de que el modelo llame a la herramienta:
// email y teléfono por patrón, y nombre si lo dice ("me llamo…") o si responde a la pregunta por su nombre.
export function extractDatos(userText: string, lastAssistantText: string): Partial<ChatDatos> {
  const found: Partial<ChatDatos> = {};

  const email = userText.match(EMAIL_PATTERN)?.[0];
  if (email) found.email = email;

  const phoneText = userText.match(PHONE_PATTERN)?.[0];
  if (phoneText) {
    const phone = validatePhone(phoneText.replace(/[\s.-]/g, ""));
    if (phone.valid && phone.phone) found.phone = phone.phone;
  }

  const prefixed = userText.match(NAME_PREFIX_PATTERN)?.[1];
  if (prefixed) {
    found.name = prefixed.trim();
  } else if (/nombre/i.test(lastAssistantText) && lastAssistantText.includes("?") && !userText.includes("?")) {
    const answer = userText.match(NAME_ANSWER_PATTERN)?.[1];
    // Respuestas que no son un nombre ("no quiero decirlo", "gracias"...) no se guardan.
    if (answer && !NOT_A_NAME.test(answer)) found.name = answer.trim();
  }

  return found;
}

// Texto para el asistente con lo que ya se sabe del cliente en esta conversación.
export function describeChatDatos(datos: ChatDatos): string {
  const known = [
    datos.name && `nombre: ${datos.name}`,
    datos.phone && `teléfono: ${datos.phone}`,
    datos.email && `email: ${datos.email}`,
    datos.motivo && `motivo de la consulta: ${datos.motivo}`,
  ].filter(Boolean);
  if (known.length === 0) return "Todavía no tienes ningún dato del cliente en esta conversación.";
  return `Datos que ya tienes del cliente en esta conversación (no los vuelvas a pedir; usa guardar_datos_cliente para corregirlos o añadir más): ${known.join("; ")}.`;
}
