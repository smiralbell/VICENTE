import { query, getAppointments, getDashboardSettings, getLeadsKpis, getLeadNotas, getTranscriptionById } from "../db";
import { isAiAvailable, isWorkingHours } from "../availability";
import { formatMadrid, parseMadridLocal } from "../dateFormat";
import { AGENT_SYSTEM_PROMPT, TOOL_DESCRIPTIONS } from "../chat/prompt";
import { CATEGORIES, CHAT_TOOLS, runSistemaRag } from "../chat/tools";

// Herramientas del MCP de socios. Todas son de SOLO LECTURA: ninguna escribe en la base de datos
// ni llama a algo que cambie el sistema (salvo el registro de tokens de OpenAI al consultar el RAG).

const LEADS = "eliasymunozabogados_leads";
const NOTAS = "eliasymunozabogados_lead_notas";
const CHAT = "eliasymunozabogados_chat_histories";
const TRANSCRIPCIONES = "eliasmunozabogados_transcripciones";
const AUDITS = "eliasymunozabogados_call_audits";
const USAGE = "eliasymunozabogados_token_usage";
const LOGS = "eliasymunozabogados_logs";
const VECTORS = "eliasymunozabogados_vectors";
const EMAILS = "eliasymunozabogados_emails";
const RETELL_API_BASE = "https://api.retellai.com";

type Args = Record<string, unknown>;
type JsonSchema = Record<string, unknown>;
export type McpTool = { name: string; description: string; inputSchema: JsonSchema; run: (args: Args) => Promise<unknown> };

// Error con un mensaje pensado para el socio (argumentos que faltan o no son válidos).
export class ToolInputError extends Error {}

function str(args: Args, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function int(args: Args, key: string, fallback: number, min: number, max: number): number {
  const n = Number(args[key]);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}

function paging(args: Args, porDefecto = 50) {
  const pagina = int(args, "pagina", 1, 1, 100000);
  const porPagina = int(args, "por_pagina", porDefecto, 1, 200);
  return { pagina, porPagina, offset: (pagina - 1) * porPagina };
}

function paginacion(total: number, pagina: number, porPagina: number) {
  return { pagina, por_pagina: porPagina, total, hay_siguiente: pagina * porPagina < total };
}

// DD-MM-YYYY (hora de Madrid) → inicio de ese día.
function parseDia(text: string, key: string): Date | null {
  if (!text) return null;
  const m = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  const date = m ? parseMadridLocal(`${m[1]}/${m[2]}/${m[3]} 00:00`) : null;
  if (!date) throw new ToolInputError(`${key} debe tener el formato DD-MM-YYYY`);
  return date;
}

function madrid(value: Date | string | null | undefined): string | null {
  return value ? formatMadrid(value) : null;
}

function snippet(text: string, term: string, radius = 120): string {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text.slice(0, radius * 2);
  return `${i > radius ? "…" : ""}${text.slice(Math.max(0, i - radius), i + term.length + radius)}${i + term.length + radius < text.length ? "…" : ""}`;
}

function digits(text: string): string {
  return text.replace(/\D/g, "");
}

const PAGE_PROPS = {
  pagina: { type: "integer", description: "Página, desde 1 (por defecto 1)." },
  por_pagina: { type: "integer", description: "Resultados por página (por defecto 50, máximo 200)." },
};

// Oculta tokens y claves que aparezcan en la configuración (por ejemplo, ?token= en las URLs de las herramientas de Retell).
function redact(value: unknown): unknown {
  const text = JSON.stringify(value)
    .replace(/([?&]token=)[^&"\\\s]+/gi, "$1***")
    .replace(/("(?:[a-z_]*api[_-]?key|[a-z_]*secret|[a-z_]*password|authorization)"\s*:\s*)"[^"]*"/gi, '$1"***"');
  return JSON.parse(text);
}

// Solo consultas a Retell. list-agents es POST (con filtros en el cuerpo) pero no cambia nada.
async function retellRequest(path: string, body?: unknown): Promise<unknown> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new ToolInputError("RETELL_API_KEY no está configurada en el servidor");
  const res = await fetch(`${RETELL_API_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${apiKey}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Retell respondió ${res.status} a ${path}`);
  return res.json();
}

type RetellAgent = { agent_id: string; agent_name?: string; version?: number; is_published?: boolean; response_engine?: { type?: string; llm_id?: string } };

// Agentes de voz (POST /v2/list-agents, que sustituye a GET /list-agents desde julio de 2026), con paginación.
async function listVoiceAgents(): Promise<RetellAgent[]> {
  const agents: RetellAgent[] = [];
  let paginationKey: string | undefined;
  for (let page = 0; page < 10; page++) {
    const data = (await retellRequest("/v2/list-agents", {
      filter_criteria: { channel: { type: "string", op: "eq", value: "voice" } },
      ...(paginationKey ? { pagination_key: paginationKey } : {}),
    })) as { items?: RetellAgent[]; has_more?: boolean; pagination_key?: string };
    agents.push(...(data.items ?? []));
    if (!data.has_more || !data.pagination_key) break;
    paginationKey = data.pagination_key;
  }
  return agents;
}

type LeadRow = {
  id: number;
  created_at: Date;
  name: string | null;
  phone: string | null;
  email: string | null;
  session_id: string | null;
  source: string | null;
  status: string | null;
  gestion_estado: string | null;
  cita_inicio: Date | null;
  modalidad: string | null;
  summary: string | null;
  resumen_llamada: string | null;
  call_attempts: number | null;
};

const LEAD_COLS = "id, created_at, name, phone, email, session_id, source, status, gestion_estado, cita_inicio, modalidad, summary, resumen_llamada, call_attempts";

function leadOut(lead: LeadRow, full = false) {
  return {
    id: lead.id,
    creado: madrid(lead.created_at),
    nombre: lead.name,
    telefono: lead.phone,
    email: lead.email,
    sesion: lead.session_id,
    origen: lead.source,
    estado_llamada: lead.status,
    gestion: lead.gestion_estado,
    cita: madrid(lead.cita_inicio),
    modalidad: lead.modalidad,
    intentos_llamada: lead.call_attempts,
    resumen: full ? lead.summary : lead.summary?.slice(0, 200) ?? null,
    ...(full ? { resumen_ultima_llamada: lead.resumen_llamada } : {}),
  };
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "resumen",
    description: "Cifras generales del sistema: leads por estado de gestión, citas de los próximos 7 días, conversaciones, llamadas, problemas detectados en llamadas y errores recientes. Empieza por aquí.",
    inputSchema: { type: "object", properties: {} },
    async run() {
      const [kpis, settings, extra] = await Promise.all([
        getLeadsKpis(),
        getDashboardSettings(),
        query<Record<string, string>>(
          `SELECT
             (SELECT COUNT(*) FROM ${LEADS} WHERE created_at > NOW() - interval '7 days')::text AS leads_7d,
             (SELECT COUNT(*) FROM ${LEADS} WHERE cita_inicio >= NOW() AND cita_inicio < NOW() + interval '7 days')::text AS citas_7d,
             (SELECT COUNT(DISTINCT session_id) FROM ${CHAT})::text AS conversaciones,
             (SELECT COUNT(*) FROM ${TRANSCRIPCIONES})::text AS llamadas,
             (SELECT COUNT(*) FROM ${AUDITS} WHERE problem IS NOT NULL AND created_at > NOW() - interval '7 days')::text AS problemas_llamadas_7d,
             (SELECT COUNT(*) FROM ${LOGS} WHERE created_at > NOW() - interval '24 hours')::text AS errores_24h`
        ),
      ]);
      const e = extra.rows[0] ?? {};
      return {
        leads: { ...kpis, ultimos_7_dias: Number(e.leads_7d ?? 0) },
        citas_proximos_7_dias: Number(e.citas_7d ?? 0),
        conversaciones_chat: Number(e.conversaciones ?? 0),
        llamadas_transcritas: Number(e.llamadas ?? 0),
        llamadas_con_problema_7_dias: Number(e.problemas_llamadas_7d ?? 0),
        errores_ultimas_24h: Number(e.errores_24h ?? 0),
        sistema: { publicado: settings.systemPublished, solo_fuera_de_horario: settings.offWorkOnly },
      };
    },
  },
  {
    name: "listar_leads",
    description: "Lista los leads del más reciente al más antiguo, con filtros opcionales por texto (nombre, email o teléfono) y por estado de gestión. Por páginas.",
    inputSchema: {
      type: "object",
      properties: {
        buscar: { type: "string", description: "Texto en el nombre, email o teléfono." },
        gestion: { type: "string", enum: ["pendiente", "cita_pendiente", "cita_confirmada", "derivado", "cerrado"], description: "Estado de gestión." },
        ...PAGE_PROPS,
      },
    },
    async run(args) {
      const { pagina, porPagina, offset } = paging(args);
      const where: string[] = [];
      const params: (string | number)[] = [];
      const buscar = str(args, "buscar");
      if (buscar) {
        params.push(`%${buscar}%`);
        where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`);
      }
      const gestion = str(args, "gestion");
      if (gestion) {
        params.push(gestion);
        where.push(`gestion_estado = $${params.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [total, rows] = await Promise.all([
        query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${LEADS} ${whereSql}`, params),
        query<LeadRow>(`SELECT ${LEAD_COLS} FROM ${LEADS} ${whereSql} ORDER BY created_at DESC LIMIT ${porPagina} OFFSET ${offset}`, params),
      ]);
      return { leads: rows.rows.map((l) => leadOut(l)), paginacion: paginacion(Number(total.rows[0]?.n ?? 0), pagina, porPagina) };
    },
  },
  {
    name: "ver_lead",
    description: "Ficha completa de un lead: datos, cita, notas del equipo, otros leads con el mismo teléfono, sus llamadas, las auditorías de esas llamadas y su conversación de chat. Pide el id (de listar_leads) o un teléfono.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Id del lead." },
        telefono: { type: "string", description: "Teléfono (basta con los últimos dígitos, 6 o más)." },
      },
    },
    async run(args) {
      const id = int(args, "id", 0, 0, Number.MAX_SAFE_INTEGER);
      const tel = digits(str(args, "telefono"));
      let lead: LeadRow | undefined;
      if (id) {
        lead = (await query<LeadRow>(`SELECT ${LEAD_COLS} FROM ${LEADS} WHERE id = $1`, [id])).rows[0];
      } else if (tel.length >= 6) {
        lead = (await query<LeadRow>(`SELECT ${LEAD_COLS} FROM ${LEADS} WHERE regexp_replace(phone, '\\D', '', 'g') LIKE $1 ORDER BY created_at DESC LIMIT 1`, [`%${tel}`])).rows[0];
      } else {
        throw new ToolInputError("Indica id o un teléfono de al menos 6 dígitos");
      }
      if (!lead) return { encontrado: false };

      const phone = lead.phone ?? "";
      const [notas, otros, llamadas, auditorias, chat] = await Promise.all([
        getLeadNotas(lead.id),
        phone
          ? query<LeadRow>(`SELECT ${LEAD_COLS} FROM ${LEADS} WHERE phone = $1 AND id <> $2 ORDER BY created_at DESC`, [phone, lead.id])
          : Promise.resolve({ rows: [] as LeadRow[] }),
        phone
          ? query<{ id: number; fecha: Date | null; len: number }>(`SELECT id, fecha, length(transcription) AS len FROM ${TRANSCRIPCIONES} WHERE phone = $1 ORDER BY fecha DESC NULLS LAST, id DESC`, [phone])
          : Promise.resolve({ rows: [] }),
        phone
          ? query<Record<string, unknown>>(`SELECT created_at, call_id, user_requested_derivation, user_requested_appointment, used_derivation_tool, used_appointment_tool, problem, explanation FROM ${AUDITS} WHERE phone = $1 ORDER BY created_at DESC LIMIT 20`, [phone])
          : Promise.resolve({ rows: [] }),
        lead.session_id
          ? query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${CHAT} WHERE session_id = $1`, [lead.session_id])
          : Promise.resolve({ rows: [] as { n: string }[] }),
      ]);
      const mensajes = Number(chat.rows[0]?.n ?? 0);
      return {
        lead: leadOut(lead, true),
        notas: notas.map((n) => ({ fecha: madrid(n.created_at), autor: n.autor, texto: n.texto })),
        otros_leads_mismo_telefono: otros.rows.map((l) => leadOut(l)),
        llamadas: llamadas.rows.map((t) => ({ id: t.id, fecha: t.fecha, caracteres: t.len, ver: "ver_llamada con este id" })),
        auditorias_llamadas: auditorias.rows.map((a) => ({ ...a, created_at: madrid(a.created_at as Date) })),
        conversacion_chat: mensajes ? { session_id: lead.session_id, mensajes, ver: "ver_conversacion con este session_id" } : null,
      };
    },
  },
  {
    name: "listar_citas",
    description: "Citas agendadas entre dos días (por defecto, de hoy a 30 días), ordenadas por fecha, con lead, modalidad y estado de gestión.",
    inputSchema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Primer día, DD-MM-YYYY (incluido). Por defecto hoy." },
        hasta: { type: "string", description: "Último día, DD-MM-YYYY (incluido). Por defecto dentro de 30 días." },
      },
    },
    async run(args) {
      const desde = parseDia(str(args, "desde"), "desde") ?? new Date(new Date().setUTCHours(0, 0, 0, 0));
      const hastaDia = parseDia(str(args, "hasta"), "hasta");
      const hasta = hastaDia ? new Date(hastaDia.getTime() + 86400e3) : new Date(desde.getTime() + 31 * 86400e3);
      const rows = await getAppointments(desde, hasta, "");
      return {
        total: rows.length,
        citas: rows.map((r) => ({ lead_id: r.id, cita: madrid(r.cita_inicio), nombre: r.name, telefono: r.phone, modalidad: r.modalidad, gestion: r.gestion_estado, resumen: r.summary?.slice(0, 200) ?? null })),
      };
    },
  },
  {
    name: "listar_conversaciones",
    description: "Conversaciones del chat web, de la más reciente a la más antigua, con el lead asociado y el número de mensajes. Filtro opcional por texto (sesión, nombre, email o teléfono del lead). Por páginas.",
    inputSchema: { type: "object", properties: { buscar: { type: "string", description: "Texto a buscar." }, ...PAGE_PROPS } },
    async run(args) {
      const { pagina, porPagina, offset } = paging(args);
      const buscar = str(args, "buscar");
      const params: string[] = [];
      let filtro = "";
      if (buscar) {
        params.push(`%${buscar}%`);
        filtro = `AND (c.session_id ILIKE $1 OR l.name ILIKE $1 OR l.email ILIKE $1 OR l.phone ILIKE $1)`;
      }
      const base = `FROM ${CHAT} c LEFT JOIN ${LEADS} l ON l.session_id = c.session_id WHERE c.session_id IS NOT NULL AND c.session_id <> '' ${filtro}`;
      const [total, rows] = await Promise.all([
        query<{ n: string }>(`SELECT COUNT(DISTINCT c.session_id)::text AS n ${base}`, params),
        query<{ session_id: string; mensajes: number; nombre: string | null; telefono: string | null; lead_id: number | null }>(
          `SELECT c.session_id, COUNT(*)::int AS mensajes, MAX(l.name) AS nombre, MAX(l.phone) AS telefono, MAX(l.id) AS lead_id
           ${base} GROUP BY c.session_id ORDER BY MAX(c.id) DESC LIMIT ${porPagina} OFFSET ${offset}`,
          params
        ),
      ]);
      return { conversaciones: rows.rows, paginacion: paginacion(Number(total.rows[0]?.n ?? 0), pagina, porPagina) };
    },
  },
  {
    name: "ver_conversacion",
    description: "Mensajes de una conversación del chat web en orden (cliente e IA), con las herramientas que usó la IA. Por páginas de 100 mensajes.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string", description: "Id de la sesión (de listar_conversaciones o ver_lead)." }, ...PAGE_PROPS },
      required: ["session_id"],
    },
    async run(args) {
      const sessionId = str(args, "session_id");
      if (!sessionId) throw new ToolInputError("Falta session_id");
      const { pagina, porPagina, offset } = paging(args, 100);
      const [total, rows] = await Promise.all([
        query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${CHAT} WHERE session_id = $1`, [sessionId]),
        query<{ id: number; message: { type?: string; content?: unknown; tool_calls?: { name?: string; args?: unknown }[] } }>(
          `SELECT id, message FROM ${CHAT} WHERE session_id = $1 ORDER BY id ASC LIMIT ${porPagina} OFFSET ${offset}`,
          [sessionId]
        ),
      ]);
      return {
        session_id: sessionId,
        mensajes: rows.rows.map((r) => ({
          id: r.id,
          emisor: r.message?.type === "human" ? "cliente" : r.message?.type === "ai" ? "ia" : r.message?.type ?? "?",
          texto: r.message?.content,
          ...(r.message?.tool_calls?.length ? { herramientas: r.message.tool_calls.map((t) => ({ nombre: t.name, argumentos: t.args })) } : {}),
        })),
        paginacion: paginacion(Number(total.rows[0]?.n ?? 0), pagina, porPagina),
      };
    },
  },
  {
    name: "buscar",
    description: "Busca un texto literal (sin distinguir mayúsculas) en los mensajes del chat y en las transcripciones de llamadas, de lo más reciente a lo más antiguo, con un fragmento de cada coincidencia. Por páginas.",
    inputSchema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Texto a buscar (2 caracteres o más)." },
        fuente: { type: "string", enum: ["chat", "llamadas"], description: "Solo chat o solo llamadas. Por defecto, las dos." },
        ...PAGE_PROPS,
      },
      required: ["texto"],
    },
    async run(args) {
      const texto = str(args, "texto");
      if (texto.length < 2) throw new ToolInputError("texto debe tener 2 caracteres o más");
      const fuente = str(args, "fuente");
      const { pagina, porPagina, offset } = paging(args);
      // Sin comodines: % y _ se buscan tal cual.
      const like = `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const partes: string[] = [];
      if (fuente !== "llamadas") {
        partes.push(`SELECT 'chat' AS fuente, id, session_id AS referencia, NULL::date AS fecha, message->>'type' AS emisor, message->>'content' AS texto FROM ${CHAT} WHERE message->>'content' ILIKE $1`);
      }
      if (fuente !== "chat") {
        partes.push(`SELECT 'llamada' AS fuente, id, phone AS referencia, fecha, NULL AS emisor, transcription AS texto FROM ${TRANSCRIPCIONES} WHERE transcription ILIKE $1`);
      }
      const union = partes.join(" UNION ALL ");
      const [total, rows] = await Promise.all([
        query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM (${union}) x`, [like]),
        query<{ fuente: string; id: number; referencia: string; fecha: Date | null; emisor: string | null; texto: string }>(
          `SELECT * FROM (${union}) x ORDER BY fecha DESC NULLS LAST, id DESC LIMIT ${porPagina} OFFSET ${offset}`,
          [like]
        ),
      ]);
      return {
        resultados: rows.rows.map((r) => ({
          fuente: r.fuente,
          ...(r.fuente === "chat"
            ? { mensaje_id: r.id, session_id: r.referencia, emisor: r.emisor === "human" ? "cliente" : "ia" }
            : { llamada_id: r.id, telefono: r.referencia, fecha: r.fecha }),
          fragmento: snippet(r.texto ?? "", texto),
        })),
        paginacion: paginacion(Number(total.rows[0]?.n ?? 0), pagina, porPagina),
      };
    },
  },
  {
    name: "listar_llamadas",
    description: "Llamadas transcritas de la más reciente a la más antigua, con teléfono, nombre y el inicio de la transcripción. Filtro opcional por nombre o teléfono. Por páginas.",
    inputSchema: { type: "object", properties: { buscar: { type: "string", description: "Nombre o teléfono." }, ...PAGE_PROPS } },
    async run(args) {
      const { pagina, porPagina, offset } = paging(args);
      const buscar = str(args, "buscar");
      const params: string[] = buscar ? [`%${buscar}%`] : [];
      const where = buscar ? `WHERE name ILIKE $1 OR phone ILIKE $1` : "";
      const [total, rows] = await Promise.all([
        query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${TRANSCRIPCIONES} ${where}`, params),
        query<{ id: number; fecha: Date | null; phone: string | null; name: string | null; transcription: string | null }>(
          `SELECT id, fecha, phone, name, transcription FROM ${TRANSCRIPCIONES} ${where} ORDER BY fecha DESC NULLS LAST, id DESC LIMIT ${porPagina} OFFSET ${offset}`,
          params
        ),
      ]);
      return {
        llamadas: rows.rows.map((t) => ({ id: t.id, fecha: t.fecha, telefono: t.phone, nombre: t.name, inicio: (t.transcription ?? "").slice(0, 200), caracteres: (t.transcription ?? "").length })),
        paginacion: paginacion(Number(total.rows[0]?.n ?? 0), pagina, porPagina),
      };
    },
  },
  {
    name: "ver_llamada",
    description: "Transcripción completa de una llamada, con el resumen del lead y las auditorías de las llamadas de ese teléfono (si el cliente pidió cita o derivación y si el agente usó la herramienta).",
    inputSchema: { type: "object", properties: { id: { type: "integer", description: "Id de la llamada (de listar_llamadas o ver_lead)." } }, required: ["id"] },
    async run(args) {
      const id = int(args, "id", 0, 0, Number.MAX_SAFE_INTEGER);
      if (!id) throw new ToolInputError("Falta id");
      const t = await getTranscriptionById(id);
      if (!t) return { encontrada: false };
      const auditorias = t.phone
        ? (await query<Record<string, unknown>>(`SELECT created_at, call_id, user_requested_derivation, user_requested_appointment, used_derivation_tool, used_appointment_tool, problem, explanation FROM ${AUDITS} WHERE phone = $1 ORDER BY created_at DESC LIMIT 10`, [t.phone])).rows
        : [];
      return {
        id: t.id,
        fecha: t.fecha,
        telefono: t.phone,
        nombre: t.name,
        email: t.mail,
        resumen_lead: t.summary,
        transcripcion: t.transcription,
        auditorias_de_este_telefono: auditorias.map((a) => ({ ...a, created_at: madrid(a.created_at as Date) })),
      };
    },
  },
  {
    name: "ver_auditorias",
    description: "Auditorías automáticas de las llamadas: si el cliente pidió cita o derivación, si el agente de voz usó la herramienta correspondiente y el problema detectado. Útil para encontrar llamadas que fallaron. Por páginas.",
    inputSchema: { type: "object", properties: { solo_problemas: { type: "boolean", description: "Solo las que tienen un problema." }, ...PAGE_PROPS } },
    async run(args) {
      const { pagina, porPagina, offset } = paging(args);
      const where = args.solo_problemas === true ? "WHERE problem IS NOT NULL" : "";
      const [total, rows] = await Promise.all([
        query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${AUDITS} ${where}`),
        query<Record<string, unknown>>(`SELECT * FROM ${AUDITS} ${where} ORDER BY created_at DESC LIMIT ${porPagina} OFFSET ${offset}`),
      ]);
      return {
        auditorias: rows.rows.map((a) => ({ ...a, created_at: madrid(a.created_at as Date) })),
        paginacion: paginacion(Number(total.rows[0]?.n ?? 0), pagina, porPagina),
      };
    },
  },
  {
    name: "ver_prompt",
    description: "Prompt completo del agente del chat web (etapas, reglas, precios y ejemplos), tal como está en producción. {{FECHA}} se sustituye en cada mensaje por la fecha y hora de Madrid.",
    inputSchema: { type: "object", properties: {} },
    async run() {
      return { caracteres: AGENT_SYSTEM_PROMPT.length, prompt: AGENT_SYSTEM_PROMPT };
    },
  },
  {
    name: "ver_herramientas",
    description: "Herramientas que puede usar la IA del chat web (buscar en la base de conocimiento, agendar, derivar, guardar datos): nombre, descripción que lee el modelo y parámetros.",
    inputSchema: { type: "object", properties: {} },
    async run() {
      return { herramientas: CHAT_TOOLS.map((t) => t.function), descripciones_largas: TOOL_DESCRIPTIONS, categorias_rag: CATEGORIES };
    },
  },
  {
    name: "ver_agente_voz",
    description: "Configuración de los agentes de voz de Retell: sin agent_id, la lista de agentes; con agent_id, su configuración y su prompt y herramientas. Los tokens de las URLs aparecen ocultos.",
    inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Id del agente (de la lista)." } } },
    async run(args) {
      const agentId = str(args, "agent_id");
      if (!agentId) {
        const agents = await listVoiceAgents();
        const latest = new Map<string, RetellAgent>();
        for (const a of agents) {
          const prev = latest.get(a.agent_id);
          if (!prev || (a.version ?? 0) > (prev.version ?? 0)) latest.set(a.agent_id, a);
        }
        return { agentes: Array.from(latest.values()).map((a) => ({ agent_id: a.agent_id, nombre: a.agent_name, version: a.version, publicado: a.is_published, motor: a.response_engine?.type })) };
      }
      const agent = (await retellRequest(`/get-agent/${encodeURIComponent(agentId)}`)) as RetellAgent;
      const llmId = agent.response_engine?.type === "retell-llm" ? agent.response_engine.llm_id : undefined;
      const llm = llmId ? await retellRequest(`/get-retell-llm/${encodeURIComponent(llmId)}`) : null;
      return redact({ agente: agent, llm });
    },
  },
  {
    name: "consultar_rag",
    description: "Hace una pregunta a la base de conocimiento del despacho (la misma herramienta sistema_rag que usan el chat y el agente de voz) y devuelve la respuesta. Tiene un pequeño coste de OpenAI por consulta.",
    inputSchema: {
      type: "object",
      properties: {
        pregunta: { type: "string", description: "La pregunta, como la haría un cliente." },
        categoria: { type: "string", enum: [...CATEGORIES], description: "Opcional: limita la búsqueda a una categoría." },
      },
      required: ["pregunta"],
    },
    async run(args) {
      const pregunta = str(args, "pregunta");
      if (!pregunta) throw new ToolInputError("Falta pregunta");
      const categoria = str(args, "categoria");
      const known = (CATEGORIES as readonly string[]).includes(categoria) ? categoria : undefined;
      return { pregunta, categoria: known ?? null, respuesta: await runSistemaRag({ query: pregunta, category: known }) };
    },
  },
  {
    name: "ver_documentos_rag",
    description: "Documentos de la base de conocimiento (RAG): cuántos hay por categoría y, con categoria, el inicio de cada fragmento. Por páginas.",
    inputSchema: { type: "object", properties: { categoria: { type: "string", enum: [...CATEGORIES] }, ...PAGE_PROPS } },
    async run(args) {
      const categoria = str(args, "categoria");
      if (!categoria) {
        const { rows } = await query<{ categoria: string | null; fragmentos: number }>(
          `SELECT metadata->>'category' AS categoria, COUNT(*)::int AS fragmentos FROM ${VECTORS} GROUP BY 1 ORDER BY 2 DESC`
        );
        return { por_categoria: rows };
      }
      const { pagina, porPagina, offset } = paging(args, 20);
      const [total, rows] = await Promise.all([
        query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${VECTORS} WHERE metadata->>'category' = $1`, [categoria]),
        query<{ id: string; text: string; metadata: unknown }>(`SELECT id, text, metadata FROM ${VECTORS} WHERE metadata->>'category' = $1 ORDER BY id LIMIT ${porPagina} OFFSET ${offset}`, [categoria]),
      ]);
      return {
        fragmentos: rows.rows.map((r) => ({ id: r.id, metadata: r.metadata, inicio: r.text.slice(0, 300) })),
        paginacion: paginacion(Number(total.rows[0]?.n ?? 0), pagina, porPagina),
      };
    },
  },
  {
    name: "estado_del_servicio",
    description: "Estado del sistema ahora: si está publicado, el modo «solo fuera de horario», si la IA de voz está atendiendo en este momento, si la base de datos responde y qué configuración falta (sin mostrar valores).",
    inputSchema: { type: "object", properties: {} },
    async run() {
      const t0 = Date.now();
      await query("SELECT 1");
      const dbMs = Date.now() - t0;
      const [settings, voz] = await Promise.all([getDashboardSettings(), isAiAvailable()]);
      const vars = ["DATABASE_URL", "OPENAI_API_KEY", "OPENAI_CHAT_MODEL", "RETELL_API_KEY", "RETELL_FROM_NUMBER", "RETELL_OUTBOUND_AGENT_ID", "WEBHOOK_TOKEN", "CRON_SECRET", "EMAIL_NOTIFY_TO", "BUFFALO_INCIDENTS_TOKEN"];
      return {
        ahora_madrid: formatMadrid(new Date()),
        sistema_publicado: settings.systemPublished,
        solo_fuera_de_horario: settings.offWorkOnly,
        horario_laboral_ahora: isWorkingHours(),
        ia_de_voz_atendiendo_ahora: voz,
        base_de_datos: { responde: true, ms: dbMs },
        configuracion: Object.fromEntries(vars.map((v) => [v, process.env[v] ? "configurada" : "FALTA"])),
      };
    },
  },
  {
    name: "listar_logs",
    description: "Errores de producción guardados (los mismos que se avisan al CRM de Buffalo), del más reciente al más antiguo. Se guardan desde que existe este MCP; los logs del contenedor no. Por páginas.",
    inputSchema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Primer día, DD-MM-YYYY (incluido)." },
        origen: { type: "string", description: "Parte del origen del error (p. ej. callFlows, api/agendar, chat/tools)." },
        ...PAGE_PROPS,
      },
    },
    async run(args) {
      const { pagina, porPagina, offset } = paging(args);
      const where: string[] = [];
      const params: string[] = [];
      const desde = parseDia(str(args, "desde"), "desde");
      if (desde) {
        params.push(desde.toISOString());
        where.push(`created_at >= $${params.length}`);
      }
      const origen = str(args, "origen");
      if (origen) {
        params.push(`%${origen}%`);
        where.push(`source ILIKE $${params.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [total, rows] = await Promise.all([
        query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${LOGS} ${whereSql}`, params),
        query<{ id: number; created_at: Date; level: string; source: string; message: string }>(
          `SELECT id, created_at, level, source, message FROM ${LOGS} ${whereSql} ORDER BY created_at DESC LIMIT ${porPagina} OFFSET ${offset}`,
          params
        ),
      ]);
      return {
        logs: rows.rows.map((l) => ({ id: l.id, fecha: madrid(l.created_at), nivel: l.level, origen: l.source, mensaje: l.message })),
        paginacion: paginacion(Number(total.rows[0]?.n ?? 0), pagina, porPagina),
      };
    },
  },
  {
    name: "listar_correos",
    description:
      "Correos que ha enviado el sistema (nuevo lead, derivación a abogado, cita modificada…), del más reciente al más antiguo: fecha, si se envió o falló, destinatarios, asunto y el inicio del texto. " +
      "Filtros: fechas, texto (en asunto, destinatarios o contenido, p. ej. un nombre o un teléfono) y estado. Se guardan desde que existe el registro. Por páginas.",
    inputSchema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Primer día, DD-MM-YYYY (incluido)." },
        hasta: { type: "string", description: "Último día, DD-MM-YYYY (incluido)." },
        buscar: { type: "string", description: "Texto en el asunto, los destinatarios o el contenido." },
        estado: { type: "string", enum: ["enviado", "fallido"], description: "Solo enviados o solo fallidos." },
        ...PAGE_PROPS,
      },
    },
    async run(args) {
      const { pagina, porPagina, offset } = paging(args);
      const where: string[] = [];
      const params: string[] = [];
      const desde = parseDia(str(args, "desde"), "desde");
      if (desde) {
        params.push(desde.toISOString());
        where.push(`created_at >= $${params.length}`);
      }
      const hasta = parseDia(str(args, "hasta"), "hasta");
      if (hasta) {
        params.push(new Date(hasta.getTime() + 86400e3).toISOString());
        where.push(`created_at < $${params.length}`);
      }
      const buscar = str(args, "buscar");
      if (buscar) {
        params.push(`%${buscar.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
        where.push(`(asunto ILIKE $${params.length} OR destinatarios ILIKE $${params.length} OR texto ILIKE $${params.length})`);
      }
      const estado = str(args, "estado");
      if (estado) {
        params.push(estado);
        where.push(`estado = $${params.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [total, rows] = await Promise.all([
        query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${EMAILS} ${whereSql}`, params),
        query<{ id: number; created_at: Date; estado: string; intentos: number; destinatarios: string; asunto: string; texto: string; error: string | null }>(
          `SELECT id, created_at, estado, intentos, destinatarios, asunto, texto, error FROM ${EMAILS} ${whereSql} ORDER BY created_at DESC LIMIT ${porPagina} OFFSET ${offset}`,
          params
        ),
      ]);
      return {
        correos: rows.rows.map((e) => ({
          id: e.id,
          fecha: madrid(e.created_at),
          estado: e.estado,
          intentos: e.intentos,
          destinatarios: e.destinatarios,
          asunto: e.asunto,
          inicio: buscar ? snippet(e.texto, buscar, 150) : e.texto.slice(0, 300),
          ...(e.error ? { error: e.error } : {}),
          ver: "ver_correo con este id",
        })),
        paginacion: paginacion(Number(total.rows[0]?.n ?? 0), pagina, porPagina),
      };
    },
  },
  {
    name: "ver_correo",
    description: "Un correo enviado por el sistema completo: destinatarios, copia oculta, asunto, estado, intentos, error si falló y todo el texto tal cual le llegó al despacho.",
    inputSchema: { type: "object", properties: { id: { type: "integer", description: "Id del correo (de listar_correos)." } }, required: ["id"] },
    async run(args) {
      const id = int(args, "id", 0, 0, Number.MAX_SAFE_INTEGER);
      if (!id) throw new ToolInputError("Falta id");
      const { rows } = await query<{ id: number; created_at: Date; estado: string; intentos: number; destinatarios: string; copia_oculta: string | null; asunto: string; texto: string; error: string | null }>(
        `SELECT id, created_at, estado, intentos, destinatarios, copia_oculta, asunto, texto, error FROM ${EMAILS} WHERE id = $1`,
        [id]
      );
      const e = rows[0];
      if (!e) return { encontrado: false };
      return { ...e, created_at: madrid(e.created_at) };
    },
  },
  {
    name: "ver_costes",
    description: "Tokens de OpenAI consumidos por modelo en un periodo (día, semana, mes o año hasta hoy), sumando chat, RAG y auditorías de llamadas.",
    inputSchema: { type: "object", properties: { periodo: { type: "string", enum: ["dia", "semana", "mes", "año"], description: "Por defecto, mes." } } },
    async run(args) {
      const periodo = str(args, "periodo") || "mes";
      const intervalos: Record<string, string> = { dia: "1 day", semana: "7 days", mes: "30 days", "año": "365 days" };
      const intervalo = intervalos[periodo];
      if (!intervalo) throw new ToolInputError("periodo debe ser dia, semana, mes o año");
      const { rows } = await query<{ modelo: string; llamadas: number; tokens_entrada: string; tokens_salida: string }>(
        `SELECT model AS modelo, COUNT(*)::int AS llamadas, SUM(input_tokens)::text AS tokens_entrada, SUM(output_tokens)::text AS tokens_salida
         FROM ${USAGE} WHERE created_at > NOW() - $1::interval GROUP BY model ORDER BY SUM(input_tokens) DESC`,
        [intervalo]
      );
      return {
        periodo,
        por_modelo: rows.map((r) => ({ ...r, tokens_entrada: Number(r.tokens_entrada), tokens_salida: Number(r.tokens_salida) })),
        nota: "Solo OpenAI. Retell y el correo no están incluidos.",
      };
    },
  },
];
