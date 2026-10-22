import { query, getDashboardSettings } from "./db";
import { isWorkingHours } from "./availability";
import { requireEnv } from "./env";
import { createPhoneCall } from "./retell";
import { validatePhone } from "./phone";

const LEADS_TABLE = "eliasymunozabogados_leads";

export type OutboundPayload = {
  name?: string;
  phone?: string;
  email?: string;
  summaryCase?: string;
};

export type OutboundResult = "called" | "pending_contact" | "retry_pending";

// Guarda o actualiza el lead por session_id, igual que los nodos "save-lead" de n8n.
async function upsertLead(
  sessionId: string,
  fields: { name: string; phone: string; email: string; summary: string; status: string; source: string; withLastCall: boolean }
): Promise<void> {
  const lastCall = fields.withLastCall ? "NOW()" : "NULL";
  const updated = await query(
    `UPDATE ${LEADS_TABLE}
     SET name = $2, phone = $3, email = $4, summary = $5, source = $6, status = $7, last_call_at = ${lastCall}
     WHERE session_id = $1`,
    [sessionId, fields.name, fields.phone, fields.email, fields.summary, fields.source, fields.status]
  );
  if (!updated.rowCount) {
    await query(
      `INSERT INTO ${LEADS_TABLE} (session_id, name, phone, email, summary, source, status, last_call_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ${lastCall})`,
      [sessionId, fields.name, fields.phone, fields.email, fields.summary, fields.source, fields.status]
    );
  }
}

// Formulario web → llamada automática, con las mismas reglas que el flujo agente-outbond de n8n.
export async function handleOutbound(payload: OutboundPayload): Promise<OutboundResult> {
  const name = payload.name ?? "";
  const email = payload.email ?? "";
  const summary = payload.summaryCase ?? "";
  const phone = validatePhone(payload.phone ?? "");
  const sessionId = phone.phone || email || new Date().toISOString();
  const settings = await getDashboardSettings();

  // Sistema apagado: no se llama. Se guarda el lead para no perderlo.
  if (!settings.systemPublished) {
    await upsertLead(sessionId, {
      name, phone: payload.phone ?? "", email, summary: `${summary} - El sistema está apagado, por lo que no se realizó la llamada automática.`,
      status: "pending_contact", source: "Formulario", withLastCall: false,
    });
    return "pending_contact";
  }

  // Teléfono no válido: no se llama.
  if (!phone.valid || !phone.phone) {
    await upsertLead(sessionId, {
      name, phone: payload.phone ?? "", email,
      summary: `${summary} - El usuario completó el formulario en la web, pero el número de teléfono es inválido, por lo que no se pudo realizar la llamada automáticamente.`,
      status: "pending_contact", source: "Formulario", withLastCall: false,
    });
    return "pending_contact";
  }

  // Modo "solo fuera laboral" dentro del horario laboral: no se llama ahora.
  if (settings.offWorkOnly && isWorkingHours()) {
    await upsertLead(sessionId, {
      name, phone: phone.phone, email,
      summary: `${summary} - El usuario completó el formulario dentro del horario laboral, por lo que no fue llamado automáticamente.`,
      status: "pending_contact", source: "Formulario", withLastCall: false,
    });
    return "pending_contact";
  }

  // Llamada: se guarda como retry_pending antes de llamar, igual que save-lead-3 de n8n.
  await upsertLead(sessionId, {
    name, phone: phone.phone, email, summary,
    status: "retry_pending", source: "Formulario", withLastCall: true,
  });

  try {
    await createPhoneCall({
      fromNumber: requireEnv("RETELL_FROM_NUMBER"),
      toNumber: phone.phone,
      agentId: requireEnv("RETELL_OUTBOUND_AGENT_ID"),
      dynamicVariables: { name, phone: phone.phone, email, summaryCase: summary, source: "Formulario" },
    });
    return "called";
  } catch {
    // Si Retell falla, el lead queda en retry_pending y lo recoge el cron de reintentos.
    return "retry_pending";
  }
}
