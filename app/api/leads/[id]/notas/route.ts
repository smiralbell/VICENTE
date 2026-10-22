import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { addLeadNota } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 1000;

// Añade una nota del equipo a un lead. Solo para usuarios con sesión (ver middleware).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ error: "ID no válido" }, { status: 400 });
  }

  let body: { texto?: string };
  try {
    body = await request.json();
  } catch (error) {
    reportIncident("api/leads/notas", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const texto = (body.texto ?? "").trim();
  if (!texto) {
    return NextResponse.json({ error: "La nota está vacía" }, { status: 400 });
  }
  if (texto.length > MAX_LENGTH) {
    return NextResponse.json({ error: `La nota no puede tener más de ${MAX_LENGTH} caracteres` }, { status: 400 });
  }

  try {
    await addLeadNota(leadId, texto, "Equipo del despacho");
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportIncident("api/leads/notas", error);
    return NextResponse.json({ error: "No se pudo guardar la nota" }, { status: 500 });
  }
}
