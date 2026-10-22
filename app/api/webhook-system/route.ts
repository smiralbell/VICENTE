import { NextResponse } from "next/server";
import { setSystemPublishedSetting } from "@/lib/db";

// Publica o despublica el sistema guardando la bandera directamente (sin n8n).
export async function POST(request: Request) {
  let body: { systemPublished?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.systemPublished !== "boolean") {
    return NextResponse.json(
      { error: "Body must include systemPublished: boolean" },
      { status: 400 }
    );
  }

  const action = body.systemPublished ? "publish" : "unpublish";

  try {
    const settings = await setSystemPublishedSetting(body.systemPublished);
    return NextResponse.json({ ok: true, action, ...settings });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el ajuste" }, { status: 500 });
  }
}
