import { reportIncident } from "./incidents";
import { Pool } from "pg";
import { datesMatch, pickBestByDate } from "./parseDate";
import type { LeadFilters } from "./leadFilters";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});

export async function query<T = unknown>(
  text: string,
  params?: (string | number | boolean | null)[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  } finally {
    client.release();
  }
}

// Ejecuta varias consultas en una transacción: si una falla, se deshacen todas.
export async function transaction<T>(
  fn: (run: typeof query) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  const run: typeof query = async (text, params) => {
    const result = await client.query(text, params);
    return { rows: result.rows, rowCount: result.rowCount };
  };
  try {
    await client.query("BEGIN");
    const value = await fn(run);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export type Lead = {
  id: number;
  created_at: Date;
  fecha: Date | null;
  modalidad: string | null;
  name: string;
  email: string;
  phone: string | null;
  session_id: string | null;
  summary: string | null;
  source: string | null;
  status: string | null;
  call_attempts: number | null;
  gestion_estado: string | null;
  cita_inicio: Date | null;
  resumen_llamada?: string | null;
};

export type ChatMessage = {
  id: number;
  session_id: string;
  message: Record<string, unknown>;
};

export type SessionSummary = {
  session_id: string;
  message_count: number;
  last_message_at: Date | null;
};

const LEADS_TABLE = "eliasymunozabogados_leads";
const CHAT_TABLE = "eliasymunozabogados_chat_histories";
const TRANSCRIPTIONS_TABLE = "eliasmunozabogados_transcripciones";

export type DashboardSettings = {
  offWorkOnly: boolean;
  systemPublished: boolean;
  updatedAt: Date | null;
};

export type Transcription = {
  id: number;
  transcription: string | null;
  phone: string | null;
  name: string | null;
  mail: string | null;
  fecha: Date | null;
  summary?: string | null;
};

const SORT_FIELDS = ["created_at", "name", "email", "source"] as const;
export type LeadSortField = (typeof SORT_FIELDS)[number];

export function isLeadSortField(s: string): s is LeadSortField {
  return SORT_FIELDS.includes(s as LeadSortField);
}

export type LeadKpis = {
  total: number;
  sinLlamar: number;
  pendientesGestion: number;
  citasPendientes: number;
  citasConfirmadas: number;
  derivados: number;
};

export async function getLeadsPaginated(
  page: number,
  pageSize: number,
  search?: string,
  order: "asc" | "desc" = "desc",
  sortField: LeadSortField = "created_at",
  filters: LeadFilters = {}
): Promise<{ leads: Lead[]; total: number }> {
  const offset = (page - 1) * pageSize;
  let countQuery = `SELECT COUNT(*)::int FROM ${LEADS_TABLE}`;
  let dataQuery = `SELECT id, created_at, fecha, modalidad, name, email, phone, session_id, summary, source, status, call_attempts, gestion_estado, cita_inicio, resumen_llamada FROM ${LEADS_TABLE}`;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    conditions.push(
      `(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`
    );
    params.push(`%${search.trim()}%`);
    paramIndex++;
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.from) {
    conditions.push(`created_at >= $${paramIndex}::date`);
    params.push(filters.from);
    paramIndex++;
  }

  if (filters.to) {
    conditions.push(`created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    params.push(filters.to);
    paramIndex++;
  }

  if (filters.gestion) {
    conditions.push(`gestion_estado = $${paramIndex}`);
    params.push(filters.gestion);
    paramIndex++;
  }

  if (filters.modalidad === "presencial" || filters.modalidad === "videoconferencia") {
    conditions.push(`LOWER(TRIM(modalidad)) = '${filters.modalidad}'`);
  } else if (filters.modalidad === "sin_reunion") {
    conditions.push(`NULLIF(TRIM(modalidad), '') IS NULL`);
  }

  const whereClause = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const orderDir = order === "asc" ? "ASC" : "DESC";
  const orderColumn = SORT_FIELDS.includes(sortField) ? sortField : "created_at";
  countQuery += whereClause;
  dataQuery += whereClause;
  dataQuery += ` ORDER BY ${orderColumn} ${orderDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(pageSize, offset);

  const [countResult, dataResult] = await Promise.all([
    query<{ count: number }>(countQuery, params.slice(0, paramIndex - 1)),
    query<Lead>(dataQuery, params),
  ]);

  const total = countResult.rows[0]?.count ?? 0;
  return { leads: dataResult.rows, total };
}

export async function getLeadsCounts(): Promise<{
  totalLeads: number;
  totalWithSessionId: number;
}> {
  const { rows } = await query<{ total: string; with_session: string }>(
    `SELECT
      COUNT(*)::text as total,
      COUNT(*) FILTER (WHERE session_id IS NOT NULL AND session_id != '')::text as with_session
    FROM ${LEADS_TABLE}`
  );
  return {
    totalLeads: parseInt(rows[0]?.total ?? "0", 10),
    totalWithSessionId: parseInt(rows[0]?.with_session ?? "0", 10),
  };
}

export async function setLeadGestion(id: number, gestion: string): Promise<void> {
  await query(`UPDATE ${LEADS_TABLE} SET gestion_estado = $2 WHERE id = $1`, [id, gestion]);
}

export type LeadNota = { id: number; texto: string; autor: string | null; created_at: Date };

const NOTAS_TABLE = "eliasymunozabogados_lead_notas";

export async function getLeadNotas(leadId: number): Promise<LeadNota[]> {
  const { rows } = await query<LeadNota>(
    `SELECT id, texto, autor, created_at FROM ${NOTAS_TABLE} WHERE lead_id = $1 ORDER BY created_at DESC, id DESC`,
    [leadId]
  );
  return rows;
}

export async function addLeadNota(leadId: number, texto: string, autor: string): Promise<void> {
  await query(`INSERT INTO ${NOTAS_TABLE} (lead_id, texto, autor) VALUES ($1, $2, $3)`, [leadId, texto, autor]);
}

export async function getLeadsKpis(): Promise<LeadKpis> {
  const { rows } = await query<{
    total: string;
    sin_llamar: string;
    pendientes_gestion: string;
    citas_pendientes: string;
    citas_confirmadas: string;
    derivados: string;
  }>(
    `SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'pending_contact' AND source = 'Formulario')::text AS sin_llamar,
      COUNT(*) FILTER (WHERE gestion_estado = 'pendiente')::text AS pendientes_gestion,
      COUNT(*) FILTER (WHERE gestion_estado = 'cita_pendiente')::text AS citas_pendientes,
      COUNT(*) FILTER (WHERE gestion_estado = 'cita_confirmada')::text AS citas_confirmadas,
      COUNT(*) FILTER (WHERE gestion_estado = 'derivado')::text AS derivados
    FROM ${LEADS_TABLE}`
  );
  const row = rows[0];
  return {
    total: parseInt(row?.total ?? "0", 10),
    sinLlamar: parseInt(row?.sin_llamar ?? "0", 10),
    pendientesGestion: parseInt(row?.pendientes_gestion ?? "0", 10),
    citasPendientes: parseInt(row?.citas_pendientes ?? "0", 10),
    citasConfirmadas: parseInt(row?.citas_confirmadas ?? "0", 10),
    derivados: parseInt(row?.derivados ?? "0", 10),
  };
}

export type AppointmentRow = {
  id: number;
  name: string | null;
  phone: string | null;
  modalidad: string | null;
  gestion_estado: string | null;
  cita_inicio: Date;
  summary: string | null;
};

// Citas dentro de un rango. modo: "presencial" | "videoconferencia" | "" (ambas).
export async function getAppointments(from: Date, to: Date, modo: string, gestion = ""): Promise<AppointmentRow[]> {
  const params: string[] = [from.toISOString(), to.toISOString()];
  let modeClause = "";
  if (modo === "presencial" || modo === "videoconferencia") {
    params.push(modo);
    modeClause += ` AND LOWER(TRIM(modalidad)) = $${params.length}`;
  }
  if (gestion) {
    params.push(gestion);
    modeClause += ` AND gestion_estado = $${params.length}`;
  }
  const { rows } = await query<AppointmentRow>(
    `SELECT id, name, phone, modalidad, gestion_estado, cita_inicio, summary FROM ${LEADS_TABLE}
     WHERE cita_inicio >= $1 AND cita_inicio < $2${modeClause}
     ORDER BY cita_inicio ASC`,
    params
  );
  return rows;
}

export async function getConversationSessions(
  search?: string
): Promise<SessionSummary[]> {
  const term = search?.trim();
  let q: string;
  const params: (string | number)[] = [];

  if (term) {
    q = `
      SELECT c.session_id, COUNT(*)::int as message_count, MAX(c.id) as max_id
      FROM ${CHAT_TABLE} c
      LEFT JOIN ${LEADS_TABLE} l ON l.session_id = c.session_id
      WHERE c.session_id IS NOT NULL AND c.session_id != ''
        AND (c.session_id ILIKE $1 OR l.name ILIKE $1 OR l.email ILIKE $1 OR l.phone ILIKE $1)
      GROUP BY c.session_id
      ORDER BY max_id DESC
    `;
    params.push(`%${term}%`);
  } else {
    q = `
      SELECT session_id, COUNT(*)::int as message_count, MAX(id) as max_id
      FROM ${CHAT_TABLE}
      WHERE session_id IS NOT NULL AND session_id != ''
      GROUP BY session_id
      ORDER BY max_id DESC
    `;
  }

  const { rows } = await query<{ session_id: string; message_count: number; max_id: number }>(
    q,
    params
  );

  return rows.map((r) => ({
    session_id: r.session_id,
    message_count: r.message_count,
    last_message_at: null,
  }));
}

export async function getConversationSessionsCount(): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT session_id)::text as count FROM ${CHAT_TABLE} WHERE session_id IS NOT NULL AND session_id != ''`
  );
  return parseInt(rows[0]?.count ?? "0", 10);
}

export async function getMessagesBySessionId(
  sessionId: string
): Promise<ChatMessage[]> {
  const { rows } = await query<ChatMessage>(
    `SELECT id, session_id, message FROM ${CHAT_TABLE} WHERE session_id = $1 ORDER BY id ASC`,
    [sessionId]
  );
  return rows;
}

export async function getLeadById(id: number): Promise<Lead | null> {
  const { rows } = await query<Lead>(
    `SELECT id, created_at, fecha, modalidad, name, email, phone, session_id, summary, source, status, call_attempts, gestion_estado, cita_inicio, resumen_llamada FROM ${LEADS_TABLE} WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getLeadByPhone(phone: string): Promise<Lead | null> {
  const { rows } = await query<Lead>(
    `SELECT id, created_at, fecha, modalidad, name, email, phone, session_id, summary, source, status, call_attempts, gestion_estado, cita_inicio, resumen_llamada FROM ${LEADS_TABLE} WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  return rows[0] ?? null;
}

export async function getLeadBySessionId(
  sessionId: string
): Promise<Lead | null> {
  const { rows } = await query<Lead>(
    `SELECT id, created_at, fecha, modalidad, name, email, phone, session_id, summary, source, status, call_attempts, gestion_estado, cita_inicio, resumen_llamada FROM ${LEADS_TABLE} WHERE session_id = $1 LIMIT 1`,
    [sessionId]
  );
  return rows[0] ?? null;
}

export async function getRecentLeads(limit: number): Promise<Lead[]> {
  const { rows } = await query<Lead>(
    `SELECT id, created_at, fecha, modalidad, name, email, phone, session_id, summary, source, status, call_attempts, gestion_estado, cita_inicio, resumen_llamada FROM ${LEADS_TABLE} ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getRecentLeadsCount(days: number): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text FROM ${LEADS_TABLE} WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
    [days]
  );
  return parseInt(rows[0]?.count ?? "0", 10);
}

export type SessionWithLeadAndPreview = SessionSummary & {
  lead: Lead | null;
  // Datos que el cliente dio en el chat (antes de que exista lead).
  datos: { name: string; phone: string; email: string } | null;
  last_message_preview: string | null;
};

export async function getConversationSessionsWithLeadAndPreview(
  search?: string
): Promise<SessionWithLeadAndPreview[]> {
  const sessions = await getConversationSessions(search);
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.session_id);
  const placeholders = sessionIds.map((_, i) => `$${i + 1}`).join(", ");
  const { rows: leadsRows } = await query<Lead>(
    `SELECT id, created_at, fecha, modalidad, name, email, phone, session_id, summary, source, status, call_attempts, gestion_estado, cita_inicio, resumen_llamada FROM ${LEADS_TABLE} WHERE session_id IN (${placeholders})`,
    sessionIds
  );
  const leadBySession = new Map(leadsRows.map((l) => [l.session_id!, l]));

  const { rows: datosRows } = await query<{ session_id: string; name: string; phone: string; email: string }>(
    `SELECT session_id, name, phone, email FROM eliasymunozabogados_chat_datos WHERE session_id IN (${placeholders})`,
    sessionIds
  );
  const datosBySession = new Map(datosRows.map((d) => [d.session_id, { name: d.name, phone: d.phone, email: d.email }]));

  const { rows: lastRows } = await query<{
    session_id: string;
    message: Record<string, unknown>;
  }>(
    `SELECT DISTINCT ON (session_id) session_id, message FROM ${CHAT_TABLE} WHERE session_id IN (${placeholders}) ORDER BY session_id, id DESC`,
    sessionIds
  );
  const previewBySession = new Map(
    lastRows.map((r) => {
      const msg = r.message;
      const text =
        typeof msg?.content === "string"
          ? msg.content
          : typeof msg?.text === "string"
            ? msg.text
            : typeof msg?.message === "string"
              ? msg.message
              : null;
      const preview = text ? (text.length > 80 ? text.slice(0, 80) + "…" : text) : null;
      return [r.session_id, preview];
    })
  );

  return sessions.map((s) => ({
    ...s,
    lead: leadBySession.get(s.session_id) ?? null,
    datos: datosBySession.get(s.session_id) ?? null,
    last_message_preview: previewBySession.get(s.session_id) ?? null,
  }));
}

export async function findTranscriptionIdForLead(lead: {
  phone: string | null;
  email: string;
  name: string;
  fecha: Date | string | null;
  created_at?: Date | string | null;
}): Promise<number | null> {
  const candidates = new Map<number, { id: number; fecha: Date | string | null }>();

  const addRows = (rows: { id: number; fecha: Date | string | null }[]) => {
    for (const row of rows) {
      candidates.set(row.id, row);
    }
  };

  if (lead.phone?.trim()) {
    const { rows } = await query<{ id: number; fecha: Date | string | null }>(
      `SELECT id, fecha FROM ${TRANSCRIPTIONS_TABLE} WHERE phone = $1 ORDER BY fecha DESC NULLS LAST, id DESC`,
      [lead.phone.trim()]
    );
    addRows(rows);
  }

  if (lead.email?.trim()) {
    const { rows } = await query<{ id: number; fecha: Date | string | null }>(
      `SELECT id, fecha FROM ${TRANSCRIPTIONS_TABLE} WHERE LOWER(mail) = LOWER($1) ORDER BY fecha DESC NULLS LAST, id DESC`,
      [lead.email.trim()]
    );
    addRows(rows);
  }

  if (lead.name?.trim()) {
    const { rows } = await query<{ id: number; fecha: Date | string | null }>(
      `SELECT id, fecha FROM ${TRANSCRIPTIONS_TABLE} WHERE LOWER(name) = LOWER($1) ORDER BY fecha DESC NULLS LAST, id DESC`,
      [lead.name.trim()]
    );
    addRows(rows);
  }

  const list = Array.from(candidates.values());
  if (list.length === 0) return null;
  if (list.length === 1) return list[0].id;

  const targetDate = lead.fecha ?? lead.created_at ?? null;
  const best = pickBestByDate(list, targetDate);
  return best?.id ?? null;
}

export async function findSessionIdForLead(lead: {
  id: number;
  phone: string | null;
  fecha: Date | string | null;
  created_at: Date;
  session_id: string | null;
}): Promise<string | null> {
  if (lead.session_id?.trim() && !lead.phone?.trim()) {
    return lead.session_id.trim();
  }

  if (!lead.phone?.trim()) {
    return lead.session_id?.trim() || null;
  }

  const { rows } = await query<{
    id: number;
    session_id: string;
    fecha: Date | string | null;
    created_at: Date;
  }>(
    `SELECT id, session_id, fecha, created_at FROM ${LEADS_TABLE}
     WHERE phone = $1 AND session_id IS NOT NULL AND session_id != ''
     ORDER BY created_at DESC`,
    [lead.phone.trim()]
  );

  if (rows.length === 0) return lead.session_id?.trim() || null;

  const current = rows.find((row) => row.id === lead.id);
  if (current?.session_id) return current.session_id;

  const targetDate = lead.fecha ?? lead.created_at;

  if (lead.fecha) {
    const byFecha = rows.find((row) => datesMatch(lead.fecha, row.fecha));
    if (byFecha) return byFecha.session_id;
  }

  const byCreated = rows.find((row) => datesMatch(targetDate, row.created_at));
  if (byCreated) return byCreated.session_id;

  if (lead.session_id?.trim()) return lead.session_id.trim();

  return current?.session_id ?? rows[0]?.session_id ?? null;
}

export async function getTranscriptions(
  search?: string
): Promise<Transcription[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    conditions.push(
      `(name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR mail ILIKE $${paramIndex})`
    );
    params.push(`%${search.trim()}%`);
    paramIndex++;
  }

  // Nombre y correo: los de la transcripción, o si faltan, los del lead del formulario con ese teléfono.
  const withLead = `SELECT * FROM (
      SELECT t.id, t.transcription, t.phone,
             COALESCE(NULLIF(t.name, ''), l.name) AS name,
             COALESCE(NULLIF(t.mail, ''), l.email) AS mail,
             t.fecha, l.summary AS summary
      FROM ${TRANSCRIPTIONS_TABLE} t
      LEFT JOIN LATERAL (
        SELECT name, email, summary FROM ${LEADS_TABLE}
        WHERE phone = t.phone
        ORDER BY created_at DESC LIMIT 1
      ) l ON TRUE
    ) x`;

  let queryText = withLead;
  if (conditions.length) {
    queryText += ` WHERE ${conditions.join(" AND ")}`;
  }
  queryText += " ORDER BY fecha DESC NULLS LAST, id DESC";

  const { rows } = await query<Transcription>(queryText, params);
  return rows;
}

export async function getTranscriptionById(
  id: number
): Promise<Transcription | null> {
  const { rows } = await query<Transcription>(
    `SELECT * FROM (
        SELECT t.id, t.transcription, t.phone,
               COALESCE(NULLIF(t.name, ''), l.name) AS name,
               COALESCE(NULLIF(t.mail, ''), l.email) AS mail,
               t.fecha, l.summary AS summary
        FROM ${TRANSCRIPTIONS_TABLE} t
        LEFT JOIN LATERAL (
          SELECT name, email, summary FROM ${LEADS_TABLE}
          WHERE phone = t.phone
          ORDER BY created_at DESC LIMIT 1
        ) l ON TRUE
      ) x WHERE x.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

const AGENT_FLAGS_TABLE = "eliasymunozabogados_dashboard_settings";
// Claves que leen y escriben también los flujos de n8n.
const KEY_ALWAYS_ENABLED = "agent_always_enabled";
const KEY_ALWAYS_DISABLED = "agent_always_disabled";

async function getFlagValue(key: string): Promise<string | null> {
  const { rows } = await query<{ value: string | null }>(
    `SELECT value FROM ${AGENT_FLAGS_TABLE} WHERE key = $1 LIMIT 1`,
    [key]
  );
  return rows[0]?.value ?? null;
}

async function setFlagValue(key: string, value: string): Promise<void> {
  const updated = await query(`UPDATE ${AGENT_FLAGS_TABLE} SET value = $2 WHERE key = $1`, [key, value]);
  if (!updated.rowCount) {
    await query(`INSERT INTO ${AGENT_FLAGS_TABLE} (key, value) VALUES ($1, $2)`, [key, value]);
  }
}

export async function getDashboardSettings(): Promise<DashboardSettings> {
  try {
    const [alwaysEnabled, alwaysDisabled] = await Promise.all([
      getFlagValue(KEY_ALWAYS_ENABLED),
      getFlagValue(KEY_ALWAYS_DISABLED),
    ]);
    return {
      offWorkOnly: alwaysEnabled === "false",
      systemPublished: alwaysDisabled !== "true",
      updatedAt: null,
    };
  } catch (error) {
    reportIncident("db/ajustes", error);
    return { offWorkOnly: false, systemPublished: true, updatedAt: null };
  }
}

export async function setOffWorkOnlySetting(value: boolean): Promise<DashboardSettings> {
  await setFlagValue(KEY_ALWAYS_ENABLED, value ? "false" : "true");
  return getDashboardSettings();
}

export async function setSystemPublishedSetting(value: boolean): Promise<DashboardSettings> {
  await setFlagValue(KEY_ALWAYS_DISABLED, value ? "false" : "true");
  return getDashboardSettings();
}
