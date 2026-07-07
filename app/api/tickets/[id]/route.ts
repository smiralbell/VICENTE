import { NextResponse } from "next/server";
import { deleteTicketInBuffalo } from "@/lib/buffaloWebhook";
import { deleteTicket, getTicketById, getTicketWithUpdates } from "@/lib/tickets";

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
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const buffaloResult = await deleteTicketInBuffalo({
      external_id: ticket.external_id,
      ticket_id: ticket.buffalo_ticket_id,
    });

    const buffaloNotFound = buffaloResult.status === 404;
    if (!buffaloResult.ok && !buffaloNotFound) {
      const errorMessage =
        (typeof buffaloResult.data.error === "string" && buffaloResult.data.error) ||
        (typeof buffaloResult.data.message === "string" && buffaloResult.data.message) ||
        "No se pudo eliminar la incidencia en Buffalo";
      return NextResponse.json({ error: errorMessage }, { status: buffaloResult.status || 502 });
    }

    const deleted = await deleteTicket(ticketId);
    if (!deleted) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      external_id: ticket.external_id,
      buffalo_deleted: buffaloResult.ok,
      buffalo_not_found: buffaloNotFound,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el ticket" }, { status: 500 });
  }
}
