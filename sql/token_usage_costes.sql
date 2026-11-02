-- Coste de cada consulta a OpenAI, en dólares (tarifa oficial) y en euros (cambio del BCE de ese día).
ALTER TABLE eliasymunozabogados_token_usage ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(14, 8);
ALTER TABLE eliasymunozabogados_token_usage ADD COLUMN IF NOT EXISTS cost_eur NUMERIC(14, 8);
ALTER TABLE eliasymunozabogados_token_usage ADD COLUMN IF NOT EXISTS usd_per_eur NUMERIC(10, 6);

-- Filas anteriores: con las tarifas estándar oficiales (por millón de tokens) y el cambio del BCE del 02/11/2026 (1 € = 1,1216 $).
UPDATE eliasymunozabogados_token_usage
SET cost_usd = (input_tokens * p.input + output_tokens * p.output) / 1000000.0,
    cost_eur = (input_tokens * p.input + output_tokens * p.output) / 1000000.0 / 1.1216,
    usd_per_eur = 1.1216
FROM (VALUES ('gpt-6-luna', 0.10, 0.50), ('gpt-4.1-mini', 0.40, 1.60), ('text-embedding-3-small', 0.02, 0)) AS p(model, input, output)
WHERE eliasymunozabogados_token_usage.model = p.model AND eliasymunozabogados_token_usage.cost_usd IS NULL;
