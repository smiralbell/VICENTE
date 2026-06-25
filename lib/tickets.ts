import { createHash } from "crypto";
import { query } from "./db";

const TICKETS_TABLE = "dashboard_tickets";
const TICKET_UPDATES_TABLE = "dashboard_ticket_updates";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type Ticket = {
  id: number;
  external_id: string;
  buffalo_ticket_id: string | null;
  project_ref: string;
  title: string | null;
  description: string | null;
  priority: string;
  status: TicketStatus;
  reporter_name: string | null;
  reporter_email: string | null;
  fields: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

export type TicketUpdate = {
  id: number;
  ticket_id: number;
  buffalo_ticket_id: string | null;
  event: string | null;
  status: string | null;
  message: string | null;
  updated_by: string | null;
  buffalo_updated_at: Date | null;
  created_at: Date;
};

export type TicketWithLatestUpdate = Ticket & {
  latest_message: string | null;
  latest_updated_by: string | null;
};

export function generateExternalId(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `inc-${year}-${suffix}`;
}

export function buildIdempotencyKey(
  buffaloTicketId: string,
  updatedAt: string,
  message: string | null
): string {
  const raw = `${buffaloTicketId}|${updatedAt}|${message ?? ""}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function createTicket(input: {
  external_id: string;
  project_ref: string;
  title: string | null;
  description: string | null;
  priority: string;
  reporter_name?: string | null;
  reporter_email?: string | null;
  fields?: Record<string, unknown> | null;
}): Promise<Ticket> {
  const { rows } = await query<Ticket>(
    `INSERT INTO ${TICKETS_TABLE}
      (external_id, project_ref, title, description, priority, reporter_name, reporter_email, fields)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING *`,
    [
      input.external_id,
      input.project_ref,
      input.title,
      input.description,
      input.priority,
      input.reporter_name ?? null,
      input.reporter_email ?? null,
      input.fields ? JSON.stringify(input.fields) : null,
    ]
  );
  return rows[0];
}

export async function setBuffaloTicketId(
  externalId: string,
  buffaloTicketId: string
): Promise<Ticket | null> {
  const { rows } = await query<Ticket>(
    `UPDATE ${TICKETS_TABLE}
     SET buffalo_ticket_id = $2, updated_at = NOW()
     WHERE external_id = $1
     RETURNING *`,
    [externalId, buffaloTicketId]
  );
  return rows[0] ?? null;
}

export async function getTickets(): Promise<TicketWithLatestUpdate[]> {
  const { rows } = await query<TicketWithLatestUpdate>(
    `SELECT t.*,
      u.message AS latest_message,
      u.updated_by AS latest_updated_by
     FROM ${TICKETS_TABLE} t
     LEFT JOIN LATERAL (
       SELECT message, updated_by
       FROM ${TICKET_UPDATES_TABLE}
       WHERE ticket_id = t.id
       ORDER BY buffalo_updated_at DESC NULLS LAST, id DESC
       LIMIT 1
     ) u ON true
     ORDER BY t.created_at DESC`
  );
  return rows;
}

export async function getTicketByExternalId(
  externalId: string
): Promise<Ticket | null> {
  const { rows } = await query<Ticket>(
    `SELECT * FROM ${TICKETS_TABLE} WHERE external_id = $1`,
    [externalId]
  );
  return rows[0] ?? null;
}

export async function getTicketByBuffaloId(
  buffaloTicketId: string
): Promise<Ticket | null> {
  const { rows } = await query<Ticket>(
    `SELECT * FROM ${TICKETS_TABLE} WHERE buffalo_ticket_id = $1`,
    [buffaloTicketId]
  );
  return rows[0] ?? null;
}

export async function applyBuffaloTicketUpdate(input: {
  external_id?: string;
  buffalo_ticket_id?: string;
  project_ref: string;
  status?: string;
  message?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  event?: string | null;
  idempotency_key: string;
}): Promise<{ ticket: Ticket; duplicate: boolean } | null> {
  let ticket: Ticket | null = null;

  if (input.external_id) {
    ticket = await getTicketByExternalId(input.external_id);
  }
  if (!ticket && input.buffalo_ticket_id) {
    ticket = await getTicketByBuffaloId(input.buffalo_ticket_id);
  }
  if (!ticket) return null;

  const { rows: existing } = await query<{ id: number }>(
    `SELECT id FROM ${TICKET_UPDATES_TABLE} WHERE idempotency_key = $1`,
    [input.idempotency_key]
  );
  if (existing[0]) {
    return { ticket, duplicate: true };
  }

  if (input.status) {
    const { rows } = await query<Ticket>(
      `UPDATE ${TICKETS_TABLE}
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [ticket.id, input.status]
    );
    ticket = rows[0] ?? ticket;
  }

  if (input.buffalo_ticket_id && !ticket.buffalo_ticket_id) {
    const { rows } = await query<Ticket>(
      `UPDATE ${TICKETS_TABLE}
       SET buffalo_ticket_id = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [ticket.id, input.buffalo_ticket_id]
    );
    ticket = rows[0] ?? ticket;
  }

  await query(
    `INSERT INTO ${TICKET_UPDATES_TABLE}
      (ticket_id, buffalo_ticket_id, event, status, message, updated_by, buffalo_updated_at, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      ticket.id,
      input.buffalo_ticket_id ?? ticket.buffalo_ticket_id,
      input.event ?? null,
      input.status ?? null,
      input.message ?? null,
      input.updated_by ?? null,
      input.updated_at ?? null,
      input.idempotency_key,
    ]
  );

  const { rows: refreshed } = await query<Ticket>(
    `SELECT * FROM ${TICKETS_TABLE} WHERE id = $1`,
    [ticket.id]
  );

  return { ticket: refreshed[0] ?? ticket, duplicate: false };
}

export async function getTicketUpdates(
  ticketId: number
): Promise<TicketUpdate[]> {
  const { rows } = await query<TicketUpdate>(
    `SELECT * FROM ${TICKET_UPDATES_TABLE}
     WHERE ticket_id = $1
     ORDER BY buffalo_updated_at ASC NULLS LAST, id ASC`,
    [ticketId]
  );
  return rows;
}

export async function getTicketWithUpdates(
  id: number
): Promise<{ ticket: Ticket; updates: TicketUpdate[] } | null> {
  const { rows } = await query<Ticket>(
    `SELECT * FROM ${TICKETS_TABLE} WHERE id = $1`,
    [id]
  );
  const ticket = rows[0];
  if (!ticket) return null;

  const updates = await getTicketUpdates(id);
  return { ticket, updates };
}

export async function deleteTicket(id: number): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM ${TICKETS_TABLE} WHERE id = $1`,
    [id]
  );
  return (rowCount ?? 0) > 0;
}
