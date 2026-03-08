import { NextRequest, NextResponse } from "next/server";
import { createSession, validateSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password) {
    return NextResponse.json(
      {
        error:
          "Falta DASHBOARD_PASSWORD. Configúrala como variable de entorno del contenedor en ejecución (no solo como build arg).",
      },
      { status: 500 }
    );
  }
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Falta SESSION_SECRET. Configúrala como variable de entorno del contenedor en ejecución (no solo como build arg).",
      },
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
  const ok = await validateSession();
  if (!ok) {
    return NextResponse.json(
      {
        error:
          "No se pudo crear la sesión. Comprueba que SESSION_SECRET está definida como variable de entorno en el contenedor.",
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}
