import { query } from "../db";
import { reportIncident } from "../incidents";
import { sendAviso } from "../avisos";
import { extractDatos, getChatDatos, saveChatDatos } from "./datos";
import { saveTurn } from "./memory";

const CHAT_TABLE = "eliasymunozabogados_chat_histories";

// Widget con el sistema apagado: no contesta la IA, sino un mensaje fijo, y el despacho recibe el aviso (correo gris).
// La pregunta lleva «nombre» y «?» para que la respuesta del cliente se guarde como su nombre (extractDatos).
export const OFFLINE_ASK =
  "Gracias por escribirnos. En este momento nuestro asistente no está disponible, pero su mensaje ya ha llegado al despacho " +
  "y una persona del equipo se pondrá en contacto con usted lo antes posible. ¿Me indica su nombre y un teléfono de contacto?";
export const OFFLINE_THANKS =
  "Muchas gracias, ya tenemos sus datos. Una persona del despacho se pondrá en contacto con usted lo antes posible.";

async function previousTurns(sessionId: string): Promise<{ humans: string[]; lastAi: string }> {
  const { rows } = await query<{ message: { type?: string; content?: string } }>(
    `SELECT message FROM ${CHAT_TABLE} WHERE session_id = $1 ORDER BY id ASC`,
    [sessionId]
  );
  const humans = rows.filter((r) => r.message?.type === "human").map((r) => r.message.content ?? "");
  const lastAi = [...rows].reverse().find((r) => r.message?.type === "ai")?.message.content ?? "";
  return { humans, lastAi };
}

export async function handleOfflineChat(sessionId: string, text: string): Promise<string> {
  const { humans, lastAi } = await previousTurns(sessionId);
  const before = await getChatDatos(sessionId);
  const found = extractDatos(text, lastAi);
  if (found.name || found.phone || found.email) await saveChatDatos(sessionId, found);
  const after = { ...before, ...Object.fromEntries(Object.entries(found).filter(([, v]) => v)) };

  const hasContact = Boolean(after.phone || after.email);
  const reply = hasContact ? OFFLINE_THANKS : OFFLINE_ASK;
  await saveTurn(sessionId, text, reply);

  // Un aviso al primer mensaje y otro cuando deja por primera vez un teléfono o un correo; no uno por cada mensaje.
  const first = humans.length === 0;
  const newContact = !before.phone && !before.email && hasContact;
  if (first || newContact) {
    const conversation = [...humans, text].join("\n");
    sendAviso({
      motivo: "sistema_apagado",
      canal: "widget",
      name: after.name,
      phone: after.phone,
      email: after.email,
      mensaje: conversation,
      nota: first ? undefined : "Ahora ha dejado sus datos de contacto.",
    }).catch((error) => reportIncident("chat/offline", error));
  }
  return reply;
}
