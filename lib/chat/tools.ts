import { reportIncident } from "../incidents";
import { query } from "../db";
import { requireEnv } from "../env";
import { sendMail } from "../email";
import { chatCompletion, createEmbedding, type ToolDefinition } from "../openai";
import { validatePhone } from "../phone";
import { handleDerivar } from "../derivar";
import { parseMadridLocal } from "../dateFormat";
import { ASK_NAME, emailOrFromSummary, isRealName } from "../leadData";
import { anularCitas, getCitasFuturas, sameTime, sendCitaModificadaEmail, withCitasLock, type CitaFutura } from "../citas";
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
          modifica_cita: {
            type: "boolean",
            description:
              "true solo si el cliente quiere cambiar el día o la hora de una cita que ya tenía (la anterior se anula). " +
              "false si es su primera cita o si quiere otra cita para hablar de otro asunto (se conservan las dos).",
          },
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
  // true si el cliente cambia la fecha de una cita que ya tenía; si no, es una cita nueva.
  modificaCita?: boolean;
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

  const name = isRealName(args.name ?? "") ? (args.name ?? "").trim() : saved.name.trim();
  const email = emailOrFromSummary(args.email || saved.email, args.summaryCase);
  // Sin nombre el despacho no sabe a quién recibe: se pide antes de agendar.
  if (!isRealName(name)) {
    return ASK_NAME;
  }

  const telefono = phone.phone;
  const outcome = await withCitasLock(telefono, async (run) => {
    const futuras = await getCitasFuturas(run, telefono, sessionId);

    // La misma cita ya está guardada (Retell repite a veces la herramienta): no se duplica ni se avisa otra vez.
    const sameMode = (cita: CitaFutura) => (cita.modalidad ?? "").trim().toLowerCase() === args.modalidad.trim().toLowerCase();
    if (futuras.some((cita) => sameTime(cita, when) && sameMode(cita))) {
      return { kind: "repetida" as const, otras: [] };
    }

    // Si cambia una cita que ya tenía, la anterior se anula; si es otra cita para otro asunto, se conservan las dos.
    // Solo se anula cuando hay una única cita anterior: con varias no se sabe cuál cambiar y lo revisa el despacho.
    const otras = futuras.filter((cita) => !sameTime(cita, when));
    const kind = !args.modificaCita || otras.length === 0 ? "nueva" : otras.length === 1 ? "modificada" : "revisar";
    if (kind === "modificada") {
      await anularCitas(run, otras, args.horario);
    }

    // Cada lead guarda una sola cita: si la que se conserva está en este mismo lead, la nueva va en un lead aparte.
    const keepsOwn = kind !== "modificada" && otras.some((cita) => cita.session_id === sessionId);
    const targetSession = keepsOwn ? `${sessionId}#cita-${Date.now()}` : sessionId;
    await run(
      `INSERT INTO ${LEADS_TABLE} (session_id, name, phone, email, summary, source, status, fecha, modalidad, gestion_estado, cita_inicio)
       VALUES ($1, $2, $3, $4, $5, $8, 'pending_contact', $6, $7, 'cita_pendiente', $9)
       ON CONFLICT (session_id) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), eliasymunozabogados_leads.name), phone = EXCLUDED.phone, email = COALESCE(NULLIF(EXCLUDED.email, ''), eliasymunozabogados_leads.email), summary = EXCLUDED.summary, source = EXCLUDED.source, status = EXCLUDED.status, fecha = EXCLUDED.fecha, modalidad = EXCLUDED.modalidad, gestion_estado = EXCLUDED.gestion_estado, cita_inicio = EXCLUDED.cita_inicio`,
      [targetSession, name, telefono, email, args.summaryCase, args.horario, args.modalidad, args.source ?? 'Web chat', when?.toISOString() ?? null]
    );
    return { kind, otras };
  });

  // Los correos van después de guardar: si el correo falla, la cita ya está bien guardada.
  if (outcome.kind === "repetida") {
    return "Consulta agendada. El despacho ya ha recibido el aviso.";
  }
  if (outcome.kind !== "nueva") {
    await sendCitaModificadaEmail({
      name,
      phone: phone.phone,
      email,
      modalidad: args.modalidad,
      antes: outcome.otras.map((cita) => cita.cita_inicio),
      ahora: args.horario,
      canal: args.source === "Llamada de voz" ? "por llamada" : "por el chat",
      revisar: outcome.kind === "revisar",
    });
    return outcome.kind === "modificada"
      ? "Cita modificada: la anterior queda anulada y el despacho ha recibido el aviso."
      : "Nueva cita registrada. El despacho revisará cuál de sus citas anteriores hay que anular y se lo confirmará.";
  }

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
  const saved = await getChatDatos(sessionId);
  const phone = validatePhone(args.clientPhone || saved.phone);
  if (!phone.valid || !phone.phone) {
    return "Falta un teléfono de contacto válido. Pídelo de forma natural antes de derivar el caso. No hables de formatos ni de fallos.";
  }
  const clientName = isRealName(args.clientName ?? "") ? (args.clientName ?? "").trim() : saved.name.trim();
  if (!isRealName(clientName)) {
    return ASK_NAME;
  }

  await handleDerivar({
    lawyerName: args.lawyerName ?? "",
    clientName,
    clientPhone: phone.phone,
    clientEmail: emailOrFromSummary(args.clientEmail || saved.email, args.summaryCase),
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
          modificaCita: String(args.modifica_cita) === "true",
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
