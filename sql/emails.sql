-- Registro de todos los correos que envía el sistema (avisos de lead, derivación, cita modificada...).
-- Se guarda lo que se envió de verdad, también los que fallaron, para consultarlo desde el MCP sin entrar al correo.
CREATE TABLE IF NOT EXISTS eliasymunozabogados_emails (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado TEXT NOT NULL,              -- 'enviado' o 'fallido'
  intentos INTEGER NOT NULL DEFAULT 1,
  destinatarios TEXT NOT NULL,
  copia_oculta TEXT,
  asunto TEXT NOT NULL,
  texto TEXT NOT NULL,               -- el contenido en texto plano, para leerlo y buscar
  html TEXT NOT NULL,                -- el correo tal cual se envió
  error TEXT
);
CREATE INDEX IF NOT EXISTS eliasymunozabogados_emails_created_at_idx ON eliasymunozabogados_emails (created_at);
