-- Servidor MCP de solo lectura para los socios (app/api/mcp).

-- Un token por socio. Solo se guarda el hash: el token se muestra una vez al crearlo (scripts/mcp-token.mjs).
CREATE TABLE IF NOT EXISTS eliasymunozabogados_mcp_tokens (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

-- Errores de producción (los mismos que van al CRM de Buffalo), para consultarlos aunque se redespliegue.
CREATE TABLE IF NOT EXISTS eliasymunozabogados_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL DEFAULT 'error',
  source TEXT NOT NULL,
  message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS eliasymunozabogados_logs_created_at_idx ON eliasymunozabogados_logs (created_at);
