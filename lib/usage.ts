import { reportIncident } from "./incidents";
import { query } from "./db";

const USAGE_TABLE = "eliasymunozabogados_token_usage";

// Precios por millón de tokens, en USD. Están en código para cambiarlos sin tocar la base de datos.
// Revísalos en la página de precios de OpenAI si cambian. Un modelo que no esté aquí se muestra sin coste.
export const PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};

// Guarda los tokens de una llamada a OpenAI. Nunca falla la llamada principal si el registro falla.
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

export type UsageRow = {
  hour: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
};

export type HourUsage = {
  hour: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  models: { model: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number | null }[];
};

export function costOf(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = PRICES_PER_MILLION[model];
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

// Consumo agrupado por hora (zona de Madrid) y modelo, de las últimas horas indicadas.
export async function getUsageByHour(hours: number): Promise<HourUsage[]> {
  const { rows } = await query<UsageRow>(
    `SELECT to_char(date_trunc('hour', created_at AT TIME ZONE 'Europe/Madrid'), 'YYYY-MM-DD HH24:00') AS hour,
            model,
            COUNT(*)::int AS calls,
            COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
            COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
     FROM ${USAGE_TABLE}
     WHERE created_at > NOW() - ($1::int * INTERVAL '1 hour')
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2`,
    [hours]
  );

  const byHour = new Map<string, HourUsage>();
  for (const row of rows) {
    const input = Number(row.input_tokens);
    const output = Number(row.output_tokens);
    const cost = costOf(row.model, input, output);
    const hour = byHour.get(row.hour) ?? { hour: row.hour, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, models: [] };
    hour.calls += row.calls;
    hour.inputTokens += input;
    hour.outputTokens += output;
    hour.costUsd = hour.costUsd === null || cost === null ? null : hour.costUsd + cost;
    hour.models.push({ model: row.model, calls: row.calls, inputTokens: input, outputTokens: output, costUsd: cost });
    byHour.set(row.hour, hour);
  }
  return Array.from(byHour.values());
}
