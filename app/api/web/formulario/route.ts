import { reportIncident } from "@/lib/incidents";
import { handleOutbound } from "@/lib/outbound";
import { checkWebKey, clientIp, corsHeaders, field, json, tooMany } from "@/lib/webWebhook";

export const dynamic = "force-dynamic";

// Formulario de la web, directo (sustituye al flujo agente-outbond de n8n). Acepta los mismos campos que n8n:
// name o nombre, phone o telefono, email y message (el resto, como gdpr, se ignora). Las reglas (sistema apagado,
// número extranjero, teléfono no válido, llamada) están en handleOutbound, igual que cuando llegaba por n8n.
export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const denied = checkWebKey(request);
  if (denied) return denied;

  // La web (Drupal) envía JSON; por si acaso también se acepta un formulario normal.
  let body: Record<string, unknown>;
  try {
    const type = request.headers.get("content-type") ?? "";
    body = type.includes("application/json") ? await request.json() : Object.fromEntries((await request.formData()).entries());
  } catch {
    return json(request, { error: "Invalid body" }, 400);
  }

  // Los envíos llegan desde el servidor de la web (una sola IP): límite amplio, solo contra abusos.
  if (tooMany(`form:ip:${clientIp(request)}`, 30)) return json(request, { error: "Too many requests" }, 429);

  try {
    const status = await handleOutbound({
      name: field(body.name || body.nombre, 200),
      phone: field(body.phone || body.telefono, 50),
      email: field(body.email, 200),
      summaryCase: field(body.message ?? body.summaryCase),
    });
    return json(request, { ok: true, status, message: "Workflow was started" });
  } catch (error) {
    // Como n8n, a la web siempre se le contesta que se ha recibido: el fallo queda registrado para revisarlo.
    reportIncident("api/web/formulario", error, { name: field(body.name || body.nombre, 200) });
    return json(request, { ok: false, message: "Workflow was started" });
  }
}
