-- Auditoría de llamadas: compara lo que pidió el cliente con las herramientas que usó el agente.
CREATE TABLE IF NOT EXISTS eliasymunozabogados_call_audits (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_id TEXT,
  phone TEXT,
  agent_id TEXT,
  user_requested_derivation BOOLEAN NOT NULL DEFAULT FALSE,
  user_requested_appointment BOOLEAN NOT NULL DEFAULT FALSE,
  used_derivation_tool BOOLEAN NOT NULL DEFAULT FALSE,
  used_appointment_tool BOOLEAN NOT NULL DEFAULT FALSE,
  problem TEXT,
  explanation TEXT
);
