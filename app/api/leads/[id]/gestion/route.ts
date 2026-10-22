import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { setLeadGestion } from "@/lib/db";
import { isGestionState } from "@/lib/leadFilters";

export const dynamic = "force-dynamic";

// Cambia el estado de gestión de un lead. Solo para usuarios con sesión (ver middleware).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ error: "ID no válido" }, { status: 400 });
  }

  let body: { gestion?: string };
  try {
    body = await request.json();
  } catch (error) {
    reportIncident("api/leads/gestion", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.gestion || !isGestionState(body.gestion)) {
    return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
  }

  try {
    await setLeadGestion(leadId, body.gestion);
    return NextResponse.json({ ok: true, gestion: body.gestion });
  } catch (error) {
    reportIncident("api/leads/gestion", error);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
