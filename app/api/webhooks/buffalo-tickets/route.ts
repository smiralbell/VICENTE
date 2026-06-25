import { NextResponse } from "next/server";
import {
  applyBuffaloTicketUpdate,
  buildIdempotencyKey,
} from "@/lib/tickets";

const CALLBACK_TOKEN = process.env.BUFFALO_TICKET_CALLBACK_TOKEN;
const PROJECT_REF = process.env.BUFFALO_PROJECT_REF;

export async function POST(request: Request) {
  if (!CALLBACK_TOKEN || !PROJECT_REF) {
    return NextResponse.json(
      { error: "Callback no configurado" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CALLBACK_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    event?: string;
    ticket_id?: string;
    external_id?: string;
    project_ref?: string;
    status?: string;
    message?: string;
    updated_by?: string;
    updated_at?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.project_ref || body.project_ref !== PROJECT_REF) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 400 });
  }

  if (!body.external_id && !body.ticket_id) {
    return NextResponse.json(
      { error: "Se requiere external_id o ticket_id" },
      { status: 400 }
    );
  }

  const idempotencyKey = buildIdempotencyKey(
    body.ticket_id ?? body.external_id ?? "",
    body.updated_at ?? new Date().toISOString(),
    body.message ?? null
  );

  const result = await applyBuffaloTicketUpdate({
    external_id: body.external_id,
    buffalo_ticket_id: body.ticket_id,
    project_ref: body.project_ref,
    status: body.status,
    message: body.message ?? null,
    updated_by: body.updated_by ?? null,
    updated_at: body.updated_at ?? null,
    event: body.event ?? null,
    idempotency_key: idempotencyKey,
  });

  if (!result) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    external_id: result.ticket.external_id,
    status: result.ticket.status,
  });
}
