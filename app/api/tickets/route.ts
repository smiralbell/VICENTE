import { NextResponse } from "next/server";
import {
  createTicket,
  generateExternalId,
  getTickets,
  setBuffaloTicketId,
} from "@/lib/tickets";

const WEBHOOK_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000/api/webhooks/tickets"
    : "https://n8n-crmv2-buffalo.zedf6b.easypanel.host/api/webhooks/tickets";

const PROJECT_REF = process.env.BUFFALO_PROJECT_REF;
const TICKETS_WEBHOOK_TOKEN = process.env.BUFFALO_TICKETS_WEBHOOK_TOKEN;

export async function GET() {
  try {
    const tickets = await getTickets();
    return NextResponse.json(tickets);
  } catch {
    return NextResponse.json({ error: "No se pudieron cargar los tickets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!WEBHOOK_URL || !TICKETS_WEBHOOK_TOKEN || !PROJECT_REF) {
    return NextResponse.json(
      { error: "Tickets webhook is not configured correctly" },
      { status: 500 }
    );
  }

  let body: {
    title?: string;
    description?: string;
    priority?: string;
    reporter?: { name?: string; email?: string };
    fields?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim() || null;
  const description = body.description?.trim() || null;

  if (!title && !description) {
    return NextResponse.json(
      { error: "Debe indicar al menos título o descripción" },
      { status: 400 }
    );
  }

  const priority = body.priority || "medium";
  const externalId = generateExternalId();

  const fields = body.fields
    ? Object.fromEntries(
        Object.entries(body.fields).filter(([, v]) => v !== undefined && v !== null && v !== "")
      )
    : null;

  let ticket;
  try {
    ticket = await createTicket({
      external_id: externalId,
      project_ref: PROJECT_REF,
      title,
      description,
      priority,
      reporter_name: body.reporter?.name?.trim() || null,
      reporter_email: body.reporter?.email?.trim() || null,
      fields,
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo guardar el ticket en la base de datos" },
      { status: 500 }
    );
  }

  const payload: Record<string, unknown> = {
    project_ref: PROJECT_REF,
    external_id: externalId,
    title,
    description,
    priority,
  };

  if (body.reporter?.name || body.reporter?.email) {
    payload.reporter = {
      name: body.reporter.name,
      email: body.reporter.email,
    };
  }

  if (fields && Object.keys(fields).length > 0) {
    payload.fields = fields;
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TICKETS_WEBHOOK_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      return NextResponse.json(
        {
          error: data.error || data.message || "Error al enviar la incidencia",
          external_id: externalId,
        },
        { status: res.status || 502 }
      );
    }

    if (data.ticket_id) {
      await setBuffaloTicketId(externalId, String(data.ticket_id));
    }

    return NextResponse.json(
      {
        ok: true,
        external_id: externalId,
        ticket_id: data.ticket_id ?? null,
        duplicate: data.duplicate ?? false,
        message: data.message ?? "Incidencia recibida correctamente",
      },
      { status: res.status }
    );
  } catch {
    return NextResponse.json(
      {
        error: "No se ha podido conectar con el sistema de tickets",
        external_id: externalId,
      },
      { status: 502 }
    );
  }
}
