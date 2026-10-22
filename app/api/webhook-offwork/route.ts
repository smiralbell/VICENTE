import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { setOffWorkOnlySetting } from "@/lib/db";

// Guarda la bandera directamente en la base de datos (sin n8n).
export async function POST(request: Request) {
  let body: { offWorkOnly?: boolean };
  try {
    body = await request.json();
  } catch (error) {
    reportIncident("api/webhook-offwork", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.offWorkOnly !== "boolean") {
    return NextResponse.json(
      { error: "Body must include offWorkOnly: boolean" },
      { status: 400 }
    );
  }

  const state = body.offWorkOnly ? "off" : "on";

  try {
    const settings = await setOffWorkOnlySetting(body.offWorkOnly);
    return NextResponse.json({ ok: true, state, ...settings });
  } catch (error) {
    reportIncident("api/webhook-offwork", error);
    return NextResponse.json({ error: "No se pudo guardar el ajuste" }, { status: 500 });
  }
}
