import { reportIncident } from "@/lib/incidents";
import { NextResponse } from "next/server";
import { CATEGORIES, runSistemaRag } from "@/lib/chat/tools";
import { checkWebhookToken } from "@/lib/webhookAuth";

export const dynamic = "force-dynamic";

// Herramienta sistema_rag para el agente de voz (Retell): la misma búsqueda en la base de conocimiento que usa el chat web.
type RagArgs = {
  query?: string;
  consulta?: string;
  category?: string;
};

// Retell envía los argumentos sueltos («Payload: args only») o dentro de "args".
type RagBody = RagArgs & { args?: RagArgs };

// El agente de voz envía "{{campo}}" cuando una variable no tiene valor: se trata como vacío.
function clean(value: string | undefined): string {
  const text = (value ?? "").trim();
  return /^\{\{.*\}\}$/.test(text) ? "" : text;
}

export async function POST(request: Request) {
  const denied = checkWebhookToken(request);
  if (denied) return denied;

  let raw: RagBody;
  try {
    raw = await request.json();
  } catch (error) {
    reportIncident("api/rag", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const args = raw.args ?? raw;
  const query = clean(args.query) || clean(args.consulta);
  if (!query) {
    return NextResponse.json({ result: "Falta la consulta. Pregunta al usuario qué quiere saber, de forma natural." });
  }

  // Una categoría que no existe filtraría todos los documentos: entonces se busca sin categoría.
  const category = clean(args.category);
  const knownCategory = (CATEGORIES as readonly string[]).includes(category) ? category : undefined;

  try {
    const result = await runSistemaRag({ query, category: knownCategory });
    return NextResponse.json({ result });
  } catch (error) {
    reportIncident("api/rag", error);
    // Al agente de voz no se le dice que hubo un fallo: el equipo lo revisa por su lado.
    return NextResponse.json({ result: "No tienes ahora mismo ese dato a mano. Dile al usuario, con naturalidad, que lo confirmará un abogado del despacho, y ofrécele una consulta. No menciones errores." }, { status: 500 });
  }
}
