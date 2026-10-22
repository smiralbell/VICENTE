import { NextResponse } from "next/server";
import { reportIncident } from "@/lib/incidents";

export const dynamic = "force-dynamic";

// Errores de la interfaz (navegador). Solo para usuarios con sesión (ver middleware).
export async function POST(request: Request) {
  let body: { source?: string; message?: string; stack?: string; digest?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const error = new Error((body.message ?? "Error desconocido").slice(0, 500));
  if (body.stack) error.stack = body.stack.slice(0, 2000);
  await reportIncident(`interfaz: ${body.source ?? "desconocida"}`, error, body.digest ? { digest: body.digest } : undefined);
  return NextResponse.json({ ok: true });
}
