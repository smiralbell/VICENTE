import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});

export async function query<T = unknown>(
  text: string,
  params?: (string | number | null)[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  } finally {
    client.release();
  }
}

export type Lead = {
  id: number;
  created_at: Date;
  name: string;
  email: string;
  phone: string | null;
  session_id: string | null;
  summary: string | null;
  source: string | null;
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

const SORT_FIELDS = ["created_at", "name", "email", "source"] as const;
export type LeadSortField = (typeof SORT_FIELDS)[number];

export function isLeadSortField(s: string): s is LeadSortField {
  return SORT_FIELDS.includes(s as LeadSortField);
}

export async function getLeadsPaginated(
  page: number,
  pageSize: number,
  search?: string,
  order: "asc" | "desc" = "desc",
  sortField: LeadSortField = "created_at"
): Promise<{ leads: Lead[]; total: number }> {
  const offset = (page - 1) * pageSize;
  let countQuery = `SELECT COUNT(*)::int FROM ${LEADS_TABLE}`;
  let dataQuery = `SELECT id, created_at, name, email, phone, session_id, summary, source FROM ${LEADS_TABLE}`;
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
    `SELECT id, created_at, name, email, phone, session_id, summary, source FROM ${LEADS_TABLE} WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getLeadBySessionId(
  sessionId: string
): Promise<Lead | null> {
  const { rows } = await query<Lead>(
    `SELECT id, created_at, name, email, phone, session_id, summary, source FROM ${LEADS_TABLE} WHERE session_id = $1 LIMIT 1`,
    [sessionId]
  );
  return rows[0] ?? null;
}

export async function getRecentLeads(limit: number): Promise<Lead[]> {
  const { rows } = await query<Lead>(
    `SELECT id, created_at, name, email, phone, session_id, summary, source FROM ${LEADS_TABLE} ORDER BY created_at DESC LIMIT $1`,
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
    `SELECT id, created_at, name, email, phone, session_id, summary, source FROM ${LEADS_TABLE} WHERE session_id IN (${placeholders})`,
    sessionIds
  );
  const leadBySession = new Map(leadsRows.map((l) => [l.session_id!, l]));

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
    last_message_preview: previewBySession.get(s.session_id) ?? null,
  }));
}
