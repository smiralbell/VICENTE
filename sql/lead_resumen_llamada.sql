-- Resumen que hace la IA de la llamada. Antes se guardaba en summary y pisaba el motivo del formulario.
ALTER TABLE eliasymunozabogados_leads ADD COLUMN IF NOT EXISTS resumen_llamada TEXT;
