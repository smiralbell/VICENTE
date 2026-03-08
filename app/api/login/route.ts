import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "Configuración del servidor incorrecta" },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Datos inválidos" },
      { status: 400 }
    );
  }

  const submitted = body.password ?? "";
  if (submitted !== password) {
    return NextResponse.json(
      { error: "Contraseña incorrecta" },
      { status: 401 }
    );
  }

  await createSession();
  return NextResponse.json({ success: true });
}
