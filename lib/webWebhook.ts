import { NextResponse } from "next/server";
import { webhookTokens } from "./webhookAuth";

// Utilidades de los webhooks públicos que llama la web del despacho (widget de chat y formulario), sin n8n en medio.

// Orígenes del navegador permitidos (WEB_ALLOWED_ORIGINS, separados por comas). Vacío = cualquiera, como n8n.
function allowedOrigin(request: Request): string {
  const allowed = (process.env.WEB_ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  const origin = request.headers.get("origin") ?? "";
  if (!allowed.length) return "*";
  return allowed.includes(origin) ? origin : allowed[0];
}

export function corsHeaders(request: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(request),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(request: Request, body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

// La URL lleva una clave (?key=), igual que n8n usaba una ruta secreta: así nadie puede mandar formularios falsos
// que acaben en llamadas. La clave es WEB_WEBHOOK_KEY (admite varias separadas por comas); si no está puesta, vale
// el token de siempre (WEBHOOK_TOKEN). Si no hay ninguno de los dos, no se exige.
function webKeys(): string[] {
  const own = (process.env.WEB_WEBHOOK_KEY ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return own.length ? own : webhookTokens();
}

export function checkWebKey(request: Request): NextResponse | null {
  const keys = webKeys();
  if (!keys.length) return null;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!keys.includes(key)) return json(request, { error: "Unauthorized" }, 401);
  return null;
}

export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "desconocida";
}

// Límite de peticiones en memoria (por instancia): frena abusos sin base de datos ni latencia.
const hits = new Map<string, number[]>();
export function tooMany(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    hits.forEach((times, k) => {
      if (!times.some((t) => now - t < windowMs)) hits.delete(k);
    });
  }
  return recent.length > max;
}

// Texto de un campo del formulario: siempre string, sin espacios de sobra y con un tamaño máximo.
export function field(value: unknown, max = 2000): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
}
