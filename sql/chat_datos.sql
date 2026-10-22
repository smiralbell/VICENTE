-- Datos que el cliente va dando durante el chat (nombre, teléfono, email, motivo), una fila por conversación.
-- No crea leads: solo sirve para que el asistente no pida dos veces lo mismo.
CREATE TABLE IF NOT EXISTS eliasymunozabogados_chat_datos (
  session_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  motivo TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
