import { reportIncident } from "./incidents";
import { query } from "./db";

const USAGE_TABLE = "eliasymunozabogados_token_usage";

// Tarifas oficiales de OpenAI (estándar), en dólares por millón de tokens. Fuente: developers.openai.com/api/docs/pricing (02/11/2026).
// Si se cambia de modelo, hay que añadir aquí su tarifa: sin ella el coste se guarda vacío y se avisa una vez.
export const MODEL_PRICES_USD: Record<string, { input: number; output: number }> = {
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};

// Cambio del BCE (dólares por euro) si no se puede consultar el del día.
const FALLBACK_USD_PER_EUR = 1.1216;
const RATE_TTL_MS = 12 * 60 * 60 * 1000;
let cachedRate: { value: number; at: number } | null = null;
const warnedModels = new Set<string>();

// Precio del modelo: el nombre exacto o, para versiones con fecha (gpt-6-luna-2026-…), el modelo base.
export function priceFor(model: string): { input: number; output: number } | null {
  if (MODEL_PRICES_USD[model]) return MODEL_PRICES_USD[model];
  const base = Object.keys(MODEL_PRICES_USD).find((name) => model.startsWith(`${name}-`));
  return base ? MODEL_PRICES_USD[base] : null;
}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = priceFor(model);
  return price ? (inputTokens * price.input + outputTokens * price.output) / 1_000_000 : null;
}

// Cambio oficial del Banco Central Europeo, consultado como mucho dos veces al día.
export async function usdPerEur(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.at < RATE_TTL_MS) return cachedRate.value;
  try {
    const res = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", { signal: AbortSignal.timeout(4000) });
    const rate = Number((await res.text()).match(/currency='USD' rate='([0-9.]+)'/)?.[1]);
    if (rate > 0) {
      cachedRate = { value: rate, at: Date.now() };
      return rate;
    }
  } catch {
    // Sin conexión con el BCE: se usa el último cambio conocido.
  }
  return cachedRate?.value ?? FALLBACK_USD_PER_EUR;
}

// Guarda los tokens y el coste (dólares y euros) de cada llamada a OpenAI. Nunca falla la llamada principal si el registro falla.
export async function recordUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  try {
    const usd = costUsd(model, inputTokens, outputTokens);
    if (usd === null && !warnedModels.has(model)) {
      warnedModels.add(model);
      reportIncident("usage", new Error(`Sin tarifa para el modelo «${model}»: añádela en lib/usage.ts para guardar su coste en euros`));
    }
    const rate = usd === null ? null : await usdPerEur();
    try {
      await query(
        `INSERT INTO ${USAGE_TABLE} (model, input_tokens, output_tokens, cost_usd, cost_eur, usd_per_eur) VALUES ($1, $2, $3, $4, $5, $6)`,
        [model, inputTokens, outputTokens, usd, usd === null || !rate ? null : usd / rate, rate]
      );
    } catch (error) {
      // Si aún no se ha ejecutado sql/token_usage_costes.sql, se guardan solo los tokens, como antes.
      if ((error as { code?: string }).code !== "42703") throw error;
      await query(`INSERT INTO ${USAGE_TABLE} (model, input_tokens, output_tokens) VALUES ($1, $2, $3)`, [model, inputTokens, outputTokens]);
    }
  } catch (error) {
    reportIncident("usage", error);
  }
}
