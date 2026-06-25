import { NextResponse } from "next/server";
import { getTicketWithUpdates } from "@/lib/tickets";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ticketId = parseInt(id, 10);

  if (!Number.isFinite(ticketId) || ticketId < 1) {
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
