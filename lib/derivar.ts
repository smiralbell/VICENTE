import { query } from "./db";
import { requireEnv } from "./env";
import { sendMail } from "./email";

const LEADS_TABLE = "eliasymunozabogados_leads";

export type DerivarPayload = {
  lawyerName?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  summaryCase?: string;
  sessionId?: string;
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Derivación a un abogado interno: guarda el lead y envía el resumen por correo.
export async function handleDerivar(payload: DerivarPayload): Promise<void> {
  const sessionId = payload.sessionId || payload.clientPhone || "";

  await query(
    `INSERT INTO ${LEADS_TABLE} (session_id, name, phone, email, summary, source, status)
     VALUES ($1, $2, $3, $4, $5, 'Formulario - Derivado a interno', 'pending_contact')`,
    [sessionId, payload.clientName ?? "", payload.clientPhone ?? "", payload.clientEmail ?? "", payload.summaryCase ?? ""]
  );

  const recipients = [requireEnv("EMAIL_NOTIFY_TO")];
  if (payload.clientEmail) recipients.push(payload.clientEmail);

  await sendMail({
    to: recipients.join(", "),
    subject: "Nuevo caso derivado",
    html: `<p><strong>Abogado:</strong> ${escapeHtml(payload.lawyerName ?? "")}</p>
<p><strong>Cliente:</strong> ${escapeHtml(payload.clientName ?? "")}</p>
<p><strong>Teléfono:</strong> ${escapeHtml(payload.clientPhone ?? "")}</p>
<p><strong>Email:</strong> ${escapeHtml(payload.clientEmail ?? "")}</p>
<p><strong>Resumen:</strong><br/>${escapeHtml(payload.summaryCase ?? "").replace(/\n/g, "<br/>")}</p>`,
  });
}
