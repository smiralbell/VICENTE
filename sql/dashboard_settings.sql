-- Ejecutar manualmente en PostgreSQL (una sola vez)

CREATE TABLE IF NOT EXISTS dashboard_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  offwork_only BOOLEAN NOT NULL DEFAULT false,
  system_published BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO dashboard_settings (id, offwork_only, system_published)
VALUES (1, false, true)
ON CONFLICT (id) DO NOTHING;
