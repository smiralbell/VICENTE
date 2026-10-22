-- Consumo de tokens de la API de OpenAI, una fila por llamada.
CREATE TABLE IF NOT EXISTS eliasymunozabogados_token_usage (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS eliasymunozabogados_token_usage_created_at_idx ON eliasymunozabogados_token_usage (created_at);
