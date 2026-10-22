import { NextResponse } from "next/server";
import { runRetryCalls } from "@/lib/callFlows";
import { checkCronSecret } from "@/lib/webhookAuth";

export const dynamic = "force-dynamic";

// Llamar cada 10 minutos desde un programador externo o de Easypanel,
// con la cabecera Authorization: Bearer <CRON_SECRET>.
export async function POST(request: Request) {
  const denied = checkCronSecret(request);
  if (denied) return denied;

  try {
    const result = await runRetryCalls();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Retry run failed" }, { status: 500 });
  }
}
