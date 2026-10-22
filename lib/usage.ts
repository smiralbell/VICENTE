import { reportIncident } from "./incidents";
import { query } from "./db";

const USAGE_TABLE = "eliasymunozabogados_token_usage";

// Guarda los tokens que devuelve la API de OpenAI en cada llamada. Nunca falla la llamada principal si el registro falla.
export async function recordUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  try {
    await query(
      `INSERT INTO ${USAGE_TABLE} (model, input_tokens, output_tokens) VALUES ($1, $2, $3)`,
      [model, inputTokens, outputTokens]
    );
  } catch (error) {
    reportIncident("usage", error);
  }
}
