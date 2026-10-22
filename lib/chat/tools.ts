import { reportIncident } from "../incidents";
import { query } from "../db";
import { requireEnv } from "../env";
import { sendMail } from "../email";
import { chatCompletion, createEmbedding, type ToolDefinition } from "../openai";
import { validatePhone } from "../phone";
import { handleDerivar } from "../derivar";
import { parseMadridLocal } from "../dateFormat";
import { LEAD_EMAIL_TEMPLATE } from "./leadEmailTemplate";
import { TOOL_DESCRIPTIONS } from "./prompt";

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
];

export async function runSistemaRag(args: { query: string; category?: string }): Promise<string> {
  const embedding = await createEmbedding(args.query, requireEnv("OPENAI_EMBEDDING_MODEL"));
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

export async function runAgendarConsulta(args: AgendarArgs, sessionId: string): Promise<string> {
  const phone = validatePhone(args.phone);
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

  const name = args.name ?? "";
  const email = args.email ?? "";

  await query(
    `INSERT INTO ${LEADS_TABLE} (session_id, name, phone, email, summary, source, status, fecha, modalidad, gestion_estado, cita_inicio)
     VALUES ($1, $2, $3, $4, $5, $8, 'pending_contact', $6, $7, 'cita_pendiente', $9)
     ON CONFLICT (session_id) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), eliasymunozabogados_leads.name), phone = EXCLUDED.phone, email = COALESCE(NULLIF(EXCLUDED.email, ''), eliasymunozabogados_leads.email), summary = EXCLUDED.summary, source = EXCLUDED.source, status = EXCLUDED.status, fecha = EXCLUDED.fecha, modalidad = EXCLUDED.modalidad, gestion_estado = EXCLUDED.gestion_estado, cita_inicio = EXCLUDED.cita_inicio`,
    [sessionId, name, phone.phone, email, args.summaryCase, args.horario, args.modalidad, args.source ?? 'Web chat', parseMadridLocal(args.horario)?.toISOString() ?? null]
  );

  await sendMail({
    to: requireEnv("EMAIL_NOTIFY_TO"),
    subject: "NUEVO LEAD!!",
    html: renderLeadEmail({
      fecha: args.horario,
      name,
      email,
      phone: phone.phone,
      modalidad: args.modalidad,
      summary: args.summaryCase,
    }),
  });

  return "Consulta agendada. El despacho ha recibido el aviso.";
}

export type DerivarArgs = {
  clientName?: string;
  clientPhone: string;
  clientEmail?: string;
  summaryCase: string;
  lawyerName?: string;
};

export async function runDerivarInterno(args: DerivarArgs, sessionId: string): Promise<string> {
  const phone = validatePhone(args.clientPhone);
  if (!phone.valid || !phone.phone) {
    return "Falta un teléfono de contacto válido. Pídelo de forma natural antes de derivar el caso. No hables de formatos ni de fallos.";
  }

  await handleDerivar({
    lawyerName: args.lawyerName ?? "",
    clientName: args.clientName ?? "",
    clientPhone: phone.phone,
    clientEmail: args.clientEmail ?? "",
    summaryCase: args.summaryCase,
    sessionId: phone.phone || sessionId,
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
    return "Herramienta desconocida.";
  } catch (error) {
    reportIncident("chat/tools", error);
    // Nunca se le comunica al cliente que algo ha fallado: el equipo lo revisa por su lado.
    return "La solicitud ha quedado registrada para el equipo del despacho, que le contactará para confirmar los detalles. Dile al usuario que has tomado nota, sin mencionar fallos ni errores técnicos.";
  }
}
