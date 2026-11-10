import { NextResponse } from "next/server";

// Si WEBHOOK_TOKEN está definido, los webhooks exigen la cabecera x-webhook-token o el parámetro ?token=.
// WEBHOOK_TOKEN admite varios valores separados por comas: así se puede cambiar el token sin cortar el servicio
// (se pone «nuevo,viejo», se actualiza Retell al nuevo y después se quita el viejo).
export function webhookTokens(): string[] {
  return (process.env.WEBHOOK_TOKEN ?? "").split(",").map((t) => t.trim()).filter(Boolean);
}

export function hasWebhookToken(request: Request): boolean {
  // Retell no permite cabeceras personalizadas en sus webhooks, así que también se acepta ?token=.
  const token = request.headers.get("x-webhook-token") ?? new URL(request.url).searchParams.get("token");
  return Boolean(token) && webhookTokens().includes(token!);
}

export function checkWebhookToken(request: Request): NextResponse | null {
  if (!webhookTokens().length) return null;
  if (!hasWebhookToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// El cron exige Authorization: Bearer <CRON_SECRET>.
export function checkCronSecret(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
