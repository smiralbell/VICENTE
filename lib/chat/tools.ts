import { reportIncident } from "../incidents";
import { addLeadNota, query } from "../db";
import { requireEnv } from "../env";
import { sendMail } from "../email";
import { chatCompletion, createEmbedding, type ToolDefinition } from "../openai";
import { validatePhone } from "../phone";
import { handleDerivar } from "../derivar";
import { formatMadrid, parseMadridLocal } from "../dateFormat";
import { LEAD_EMAIL_TEMPLATE } from "./leadEmailTemplate";
import { TOOL_DESCRIPTIONS } from "./prompt";
import { describeChatDatos, getChatDatos, saveChatDatos } from "./datos";

const LEADS_TABLE = "eliasymunozabogados_leads";
const VECTORS_TABLE = "eliasymunozabogados_vectors";
const RAG_TOP_K = 10;

const RAG_SYSTEM_PROMPT =
  "You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question.\n" +
  "It is mandatory that you always use the retrieved context to answer.\n" +
  "If you don't know the answer, just say that you don't know, don't try to make up an answer.\n" +
  "----------------\nContext: ";

export const CATEGORIES = [
  "equipo",
  "derecho-laboral",
  "derecho-de-familia",
  "derecho-civil",
  "derecho-mercantil",
  "derecho-penal",
  "accidentes-de-trafico",
  "reclamacion-de-cantidad",
  "indemnizaciones",
  "defectos-de-la-construccion",
  "derecho-inmobiliario",
  "procedimientos-judiciales",
] as const;

// Definiciones de herramientas para OpenAI, con las mismas descripciones que en n8n.
export const CHAT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "sistema_rag",
      description: TOOL_DESCRIPTIONS.sistema_rag,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "La consulta del cliente" },
          category: { type: "string", enum: [...CATEGORIES], description: "La categoría correspondiente" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_consulta",
      description: TOOL_DESCRIPTIONS.agendar_consulta,
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del cliente, o cadena vacía si no se conoce" },
          phone: { type: "string", description: "Teléfono del cliente. Obligatorio." },
          email: { type: "string", description: "Email del cliente, o cadena vacía si no se conoce" },
          summaryCase: { type: "string", description: "Resumen del caso con modalidad, día y hora" },
          horario: { type: "string", description: "Fecha y hora exacta en formato dd/mm/aaaa hh:mm" },
          modalidad: { type: "string", enum: ["videoconferencia", "presencial"] },
        },
        required: ["phone", "horario", "modalidad", "summaryCase"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "derivar_interno",
      description:
        "Usa derivar_interno cuando el cliente pida expresamente hablar con una persona o abogado del despacho y tengas al menos su nombre y su teléfono. " +
        "Resume el caso en summaryCase. No la uses para pedir citas: para eso está agendar_consulta.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string", description: "Nombre del cliente, o cadena vacía si no se conoce" },
          clientPhone: { type: "string", description: "Teléfono del cliente. Obligatorio." },
          clientEmail: { type: "string", description: "Email del cliente, o cadena vacía si no se conoce" },
          summaryCase: { type: "string", description: "Resumen del caso para el abogado" },
          lawyerName: { type: "string", description: "Nombre del abogado que solicita el cliente, si lo ha indicado" },
        },
        required: ["clientPhone", "summaryCase"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "guardar_datos_cliente",
      description:
        "Usa guardar_datos_cliente en cuanto el cliente te dé su nombre, su teléfono, su email o el motivo de la consulta, y cada vez que los corrija. " +
        "Envía solo los datos que el cliente te haya dado en este mensaje. Así no tendrás que volver a pedirlos.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del cliente tal como lo ha dicho" },
          phone: { type: "string", description: "Teléfono de contacto" },
          email: { type: "string", description: "Email de contacto" },
          motivo: { type: "string", description: "Motivo de la consulta, en pocas palabras" },
        },
      },
    },
  },
];

// La base de vectores se creó con este modelo (1536 dimensiones). Otro modelo daría resultados incorrectos.
const EMBEDDING_MODEL = "text-embedding-3-small";

export async function runSistemaRag(args: { query: string; category?: string }): Promise<string> {
  const embedding = await createEmbedding(args.query, EMBEDDING_MODEL);
  const vector = `[${embedding.join(",")}]`;

  const params: (string | number)[] = [vector, RAG_TOP_K];
  let where = "";
  if (args.category) {
    params.push(args.category);
    where = "WHERE metadata->>'category' = $3";
  }

  const { rows } = await query<{ content: string }>(
    `SELECT text AS content FROM ${VECTORS_TABLE} ${where} ORDER BY embedding <=> $1::vector LIMIT $2`,
    params
  );

  if (rows.length === 0) {
    return "No dispongo de información sobre ese tema en la base de conocimiento.";
  }

  const context = rows.map((row) => row.content).join("\n\n");
  const answer = await chatCompletion(requireEnv("OPENAI_CHAT_MODEL"), [
    { role: "system", content: RAG_SYSTEM_PROMPT + context },
    { role: "user", content: args.query },
  ]);
  return answer.content ?? "No dispongo de información sobre ese tema.";
}

export type AgendarArgs = {
  name?: string;
  phone: string;
  email?: string;
  summaryCase: string;
  horario: string;
  modalidad: string;
  source?: string;
};

function renderLeadEmail(values: Record<string, string>): string {
  return LEAD_EMAIL_TEMPLATE.replace(/\{\{\$json\.(\w+)\}\}/g, (_, key: string) => escapeHtml(values[key] ?? ""));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Guarda lo que el cliente va diciendo. Solo guarda el teléfono si es válido.
export async function runGuardarDatos(args: { name?: string; phone?: string; email?: string; motivo?: string }, sessionId: string): Promise<string> {
  const phone = args.phone ? validatePhone(args.phone) : null;
  const validPhone = phone && phone.valid && phone.phone ? phone.phone : "";
  await saveChatDatos(sessionId, { name: args.name ?? "", email: args.email ?? "", motivo: args.motivo ?? "", phone: validPhone });
  const now = describeChatDatos(await getChatDatos(sessionId));
  return args.phone && !validPhone ? `${now} El teléfono que ha dado no es válido: pídalo de forma natural.` : now;
}

export async function runAgendarConsulta(args: AgendarArgs, sessionId: string): Promise<string> {
  // Lo que el cliente ya ha dado en la conversación rellena los campos que falten.
  const saved = await getChatDatos(sessionId);
  const phone = validatePhone(args.phone || saved.phone);
  if (!phone.valid || !phone.phone) {
    return "Falta un teléfono de contacto válido. Pídelo de forma natural, por ejemplo: «¿Me indica un teléfono de contacto, por favor?». No hables de formatos ni de fallos.";
  }
  if (!args.horario) {
    return "Falta la fecha y hora de la reunión. Pídela de forma natural antes de agendar.";
  }
  const when = parseMadridLocal(args.horario);
  if (when && when.getTime() < Date.now()) {
    return "Esa fecha ya ha pasado. Pide al usuario otra fecha futura de forma natural, sin mencionar errores.";
  }

  const name = args.name || saved.name;
  const email = args.email || saved.email;
  const replaced = await replacePreviousCitas(phone.phone, sessionId, when, args.horario);

  await query(
    `INSERT INTO ${LEADS_TABLE} (session_id, name, phone, email, summary, source, status, fecha, modalidad, gestion_estado, cita_inicio)
     VALUES ($1, $2, $3, $4, $5, $8, 'pending_contact', $6, $7, 'cita_pendiente', $9)
     ON CONFLICT (session_id) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), eliasymunozabogados_leads.name), phone = EXCLUDED.phone, email = COALESCE(NULLIF(EXCLUDED.email, ''), eliasymunozabogados_leads.email), summary = EXCLUDED.summary, source = EXCLUDED.source, status = EXCLUDED.status, fecha = EXCLUDED.fecha, modalidad = EXCLUDED.modalidad, gestion_estado = EXCLUDED.gestion_estado, cita_inicio = EXCLUDED.cita_inicio`,
    [sessionId, name, phone.phone, email, args.summaryCase, args.horario, args.modalidad, args.source ?? 'Web chat', parseMadridLocal(args.horario)?.toISOString() ?? null]
  );

  // Si sustituye a otra cita, el despacho lo ve en el asunto y en el resumen, y no la toma por una cita más.
  const modified = replaced.length > 0;
  const previous = replaced.map((date) => formatMadrid(date)).join(", ");
  await sendMail({
    to: requireEnv("EMAIL_NOTIFY_TO"),
    subject: modified ? "CITA MODIFICADA" : "NUEVO LEAD!!",
    html: renderLeadEmail({
      fecha: args.horario,
      name,
      email,
      phone: phone.phone,
      modalidad: args.modalidad,
      summary: modified ? `Cita modificada. La cita anterior (${previous}) queda anulada.\n\n${args.summaryCase}` : args.summaryCase,
    }),
  });

  return modified
    ? "Cita modificada: la anterior queda anulada y el despacho ha recibido el aviso."
    : "Consulta agendada. El despacho ha recibido el aviso.";
}

type PreviousCita = { id: number; session_id: string | null; cita_inicio: Date };

// Una persona solo tiene una cita futura. Si vuelve a agendar (por llamada o por chat) para cambiarla,
// la nueva sustituye a la anterior: se anula en los otros leads con su teléfono, y en el mismo lead se sobrescribe.
// Devuelve las fechas de las citas sustituidas.
async function replacePreviousCitas(phone: string, sessionId: string, when: Date | null, horario: string): Promise<Date[]> {
  const { rows } = await query<PreviousCita>(
    `SELECT id, session_id, cita_inicio FROM ${LEADS_TABLE}
     WHERE (phone = $1 OR session_id = $1 OR session_id = $2) AND cita_inicio > NOW()`,
    [phone, sessionId]
  );
  // La misma fecha y hora otra vez no es un cambio de cita, sino la misma.
  const changed = rows.filter((row) => !when || new Date(row.cita_inicio).getTime() !== when.getTime());

  for (const row of changed) {
    if (row.session_id !== sessionId) {
      await query(
        `UPDATE ${LEADS_TABLE} SET cita_inicio = NULL, fecha = NULL, modalidad = NULL,
           gestion_estado = CASE WHEN gestion_estado IN ('cita_pendiente', 'cita_confirmada') THEN 'pendiente' ELSE gestion_estado END
         WHERE id = $1`,
        [row.id]
      );
    }
    await addLeadNota(row.id, `Cita del ${formatMadrid(row.cita_inicio)} anulada: el cliente la ha cambiado al ${horario}.`, "Sistema");
  }
  return changed.map((row) => row.cita_inicio);
}

export type DerivarArgs = {
  clientName?: string;
  clientPhone: string;
  clientEmail?: string;
  summaryCase: string;
  lawyerName?: string;
};

export async function runDerivarInterno(args: DerivarArgs, sessionId: string): Promise<string> {
  const saved = await getChatDatos(sessionId);
  const phone = validatePhone(args.clientPhone || saved.phone);
  if (!phone.valid || !phone.phone) {
    return "Falta un teléfono de contacto válido. Pídelo de forma natural antes de derivar el caso. No hables de formatos ni de fallos.";
  }

  await handleDerivar({
    lawyerName: args.lawyerName ?? "",
    clientName: args.clientName || saved.name,
    clientPhone: phone.phone,
    clientEmail: args.clientEmail || saved.email,
    summaryCase: args.summaryCase,
    sessionId: phone.phone || sessionId,
    source: "Web chat",
  });

  return "Caso derivado al despacho. Se ha avisado al equipo y el cliente será contactado.";
}

export async function executeTool(name: string, rawArgs: string, sessionId: string): Promise<string> {
  let args: Record<string, string | undefined>;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch (error) {
    reportIncident("chat/tools", error);
    return "No he podido leer los datos de esta petición. Pide al usuario que repita la información de forma natural.";
  }

  try {
    if (name === "sistema_rag") {
      return await runSistemaRag({ query: args.query ?? "", category: args.category });
    }
    if (name === "agendar_consulta") {
      return await runAgendarConsulta(
        {
          name: args.name,
          phone: args.phone ?? "",
          email: args.email,
          summaryCase: args.summaryCase ?? "",
          horario: args.horario ?? "",
          modalidad: args.modalidad ?? "",
        },
        sessionId
      );
    }
    if (name === "derivar_interno") {
      return await runDerivarInterno(
        {
          clientName: args.clientName,
          clientPhone: args.clientPhone ?? "",
          clientEmail: args.clientEmail,
          summaryCase: args.summaryCase ?? "",
          lawyerName: args.lawyerName,
        },
        sessionId
      );
    }
    if (name === "guardar_datos_cliente") {
      return await runGuardarDatos(
        { name: args.name, phone: args.phone, email: args.email, motivo: args.motivo },
        sessionId
      );
    }
    return "Herramienta desconocida.";
  } catch (error) {
    reportIncident("chat/tools", error);
    // Nunca se le comunica al cliente que algo ha fallado: el equipo lo revisa por su lado.
    if (name === "sistema_rag") {
      return "No tienes ahora mismo ese dato a mano. Dile al usuario, con naturalidad, que lo confirmará un abogado del despacho, y ofrécele una consulta o derivarle el caso. No digas que has tomado nota ni menciones errores.";
    }
    return "La solicitud ha quedado registrada para el equipo del despacho, que le contactará para confirmar los detalles. Dile al usuario que has tomado nota, sin mencionar fallos ni errores técnicos.";
  }
}
