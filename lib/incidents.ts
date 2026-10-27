// Envío de errores de producción al CRM de Buffalo (proyecto de este cliente).
// Nunca lanza excepciones: un fallo al avisar no debe romper el flujo principal.

const DEFAULT_ENDPOINT = "https://n8n-crmv2-buffalo.zedf6b.easypanel.host/api/webhooks/incidents";
// Id del proyecto en el CRM de Buffalo. Debe ser siempre este.
const CLIENT_ID = "504ba94c-2b9e-4f01-ab8b-65a2f8cdd25c";

export async function reportIncident(source: string, error: unknown, extra?: Record<string, unknown>): Promise<void> {
  try {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const stack = error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 8).join("\n") : "";
    const context = extra ? JSON.stringify(extra).slice(0, 1000) : "";
    const text = [
      `[${source}] ${message}`,
      stack ? `Stack:\n${stack}` : "",
      context ? `Contexto: ${context}` : "",
      `Entorno: ${process.env.NODE_ENV ?? "desconocido"} · ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");

    console.error(text);
    await saveLog(source, text);

    const token = process.env.BUFFALO_INCIDENTS_TOKEN;
    if (!token) {
      console.error("BUFFALO_INCIDENTS_TOKEN no configurado: el error no se ha enviado al CRM");
      return;
    }

    const url = process.env.BUFFALO_INCIDENTS_URL || DEFAULT_ENDPOINT;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: text, client_id: CLIENT_ID }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`El CRM respondió ${res.status} al recibir el error`);
    }
  } catch (sendError) {
    console.error("No se pudo enviar el error al CRM", sendError);
  }
}

// Guarda el error en la base de datos para consultarlo desde el MCP de socios (los logs del contenedor se pierden al redesplegar).
// Import dinámico: db.ts también usa reportIncident.
async function saveLog(source: string, text: string): Promise<void> {
  try {
    const { query } = await import("./db");
    await query(`INSERT INTO eliasymunozabogados_logs (level, source, message) VALUES ('error', $1, $2)`, [source, text.slice(0, 8000)]);
  } catch (logError) {
    console.error("No se pudo guardar el error en la tabla de logs", logError);
  }
}
