-- Gestión humana de los leads, separada del estado de la llamada (status).
ALTER TABLE eliasymunozabogados_leads ADD COLUMN IF NOT EXISTS gestion_estado TEXT NOT NULL DEFAULT 'pendiente';
ALTER TABLE eliasymunozabogados_leads ADD COLUMN IF NOT EXISTS cita_inicio TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS eliasymunozabogados_leads_cita_idx ON eliasymunozabogados_leads (cita_inicio);

CREATE TABLE IF NOT EXISTS eliasymunozabogados_lead_notas (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES eliasymunozabogados_leads(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  autor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
