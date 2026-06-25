import { NextResponse } from "next/server";
import { deleteTicket, getTicketWithUpdates } from "@/lib/tickets";

type RouteContext = { params: Promise<{ id: string }> };

function parseTicketId(id: string): number | null {
  const ticketId = parseInt(id, 10);
  if (!Number.isFinite(ticketId) || ticketId < 1) return null;
  return ticketId;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ticketId = parseTicketId(id);

  if (!ticketId) {
    return NextResponse.json({ error: "ID de ticket no válido" }, { status: 400 });
  }

  try {
    const result = await getTicketWithUpdates(ticketId);
    if (!result) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el ticket" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ticketId = parseTicketId(id);

  if (!ticketId) {
    return NextResponse.json({ error: "ID de ticket no válido" }, { status: 400 });
  }

  try {
    const deleted = await deleteTicket(ticketId);
    if (!deleted) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el ticket" }, { status: 500 });
  }
}
