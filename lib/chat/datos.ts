import { query } from "../db";

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
