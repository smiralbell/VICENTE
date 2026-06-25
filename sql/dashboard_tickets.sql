-- Ejecutar manualmente en PostgreSQL (una sola vez)

CREATE TABLE IF NOT EXISTS dashboard_tickets (
  id SERIAL PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  buffalo_ticket_id TEXT UNIQUE,
  project_ref TEXT NOT NULL,
  title TEXT,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  reporter_name TEXT,
  reporter_email TEXT,
  fields JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_ticket_updates (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES dashboard_tickets(id) ON DELETE CASCADE,
  buffalo_ticket_id TEXT,
  event TEXT,
  status TEXT,
  message TEXT,
  updated_by TEXT,
  buffalo_updated_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_tickets_status ON dashboard_tickets(status);
CREATE INDEX IF NOT EXISTS idx_dashboard_tickets_created ON dashboard_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_ticket_updates_ticket ON dashboard_ticket_updates(ticket_id);
