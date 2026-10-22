import { query } from "./db";
import { requireEnv } from "./env";
import { sendMail } from "./email";
import { findLawyer, isSendableLawyerEmail, type Lawyer } from "./lawyers";

const LEADS_TABLE = "eliasymunozabogados_leads";

export type DerivarPayload = {
  lawyerName?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  summaryCase?: string;
  sessionId?: string;
  // Canal por el que llegó: "Web chat" (chatbot) o "Llamada de voz".
  source?: string;
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const LABEL_CELL = 'style="padding:12px; background:#f7f7fb; border:1px solid #e5e7eb; font-weight:bold; color:#070b2a; width:140px;"';
const VALUE_CELL = 'style="padding:12px; border:1px solid #e5e7eb;"';

// Mismo diseño que el correo de nuevo lead. Los campos vacíos se muestran como "No indicado".
function renderLawyerBlock(lawyer: Lawyer): string {
  const value = (text: string) => (text ? escapeHtml(text) : "—");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:24px;">
                <tr><td colspan="2" style="padding:12px; background:#070b2a; color:#ffffff; font-weight:bold;">Datos de contacto del abogado</td></tr>
                <tr><td ${LABEL_CELL}>Teléfono directo</td><td ${VALUE_CELL}>${value(lawyer.phone)}</td></tr>
                <tr><td ${LABEL_CELL}>Móvil</td><td ${VALUE_CELL}>${value(lawyer.mobile)}</td></tr>
                <tr><td ${LABEL_CELL}>Extensión</td><td ${VALUE_CELL}>${value(lawyer.extension)}</td></tr>
                <tr><td ${LABEL_CELL}>Correo</td><td ${VALUE_CELL}>${value(lawyer.email)}</td></tr>
              </table>`;
}

// Mismo diseño que el correo de nuevo lead. Los campos vacíos se muestran como "No indicado".
function renderDerivarEmail(payload: DerivarPayload, lawyer: Lawyer | null): string {
  const value = (text?: string) => (text && text.trim() ? escapeHtml(text.trim()) : "No indicado");
  const summary = value(payload.summaryCase).replace(/\n/g, "<br/>");
  const lawyerBlock = lawyer
    ? renderLawyerBlock(lawyer)
    : `<p style="margin:0 0 24px; color:#b45309;">El abogado solicitado (${value(payload.lawyerName)}) no está en el directorio: revisar a mano.</p>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif; color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#070b2a; padding:28px 32px; text-align:center;">
              <a href="https://www.eliasymunozabogados.com/" target="_blank" style="text-decoration:none;">
                <img src="https://www.eliasymunozabogados.com/themes/eliasymunoz/logo.svg" alt="G. Elías y Muñoz Abogados" width="220" style="display:block; margin:0 auto 18px; width:220px; max-width:220px; height:auto; border:0;" />
              </a>
              <p style="margin:8px 0 0; color:#d7d9e8; font-size:14px;">Caso derivado desde el asistente de IA</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="background:#070b2a; color:#ffffff; padding:18px; border-radius:10px; text-align:center; margin-bottom:24px;">
                <p style="margin:0; font-size:13px; color:#d7d9e8;">Abogado solicitado</p>
                <p style="margin:5px 0 0; font-size:20px; font-weight:bold;">${value(payload.lawyerName)}</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:24px;">
                <tr><td ${LABEL_CELL}>Nombre</td><td ${VALUE_CELL}>${value(payload.clientName)}</td></tr>
                <tr><td ${LABEL_CELL}>Teléfono</td><td ${VALUE_CELL}>${value(payload.clientPhone)}</td></tr>
                <tr><td ${LABEL_CELL}>Email</td><td ${VALUE_CELL}>${value(payload.clientEmail)}</td></tr>
              </table>
              ${lawyerBlock}
              <div style="background:#f7f7fb; border-left:4px solid #070b2a; padding:18px 20px; border-radius:8px;">
                <p style="margin:0 0 8px; font-weight:bold; color:#070b2a;">Resumen del caso:</p>
                <p style="margin:0; line-height:1.6; color:#374151;">${summary}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f7f7fb; padding:18px 32px; text-align:center; color:#6b7280; font-size:12px;">
              Este mensaje ha sido generado automáticamente por el asistente de IA.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Derivación a un abogado interno: guarda el lead y envía el resumen por correo.
export async function handleDerivar(payload: DerivarPayload): Promise<void> {
  // Un valor sin rellenar del agente de voz ("{{sessionId}}") no sirve como identificador: se usa el teléfono.
  const givenSession = payload.sessionId && !/^\{\{.*\}\}$/.test(payload.sessionId.trim()) ? payload.sessionId : "";
  const sessionId = givenSession || payload.clientPhone || "";

  await query(
    `INSERT INTO ${LEADS_TABLE} (session_id, name, phone, email, summary, source, status, gestion_estado)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending_contact', 'derivado')
     ON CONFLICT (session_id) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), eliasymunozabogados_leads.name), phone = EXCLUDED.phone, email = COALESCE(NULLIF(EXCLUDED.email, ''), eliasymunozabogados_leads.email), summary = EXCLUDED.summary, source = EXCLUDED.source, status = EXCLUDED.status, fecha = EXCLUDED.fecha, modalidad = EXCLUDED.modalidad, gestion_estado = EXCLUDED.gestion_estado, cita_inicio = EXCLUDED.cita_inicio`,
    [sessionId, payload.clientName ?? "", payload.clientPhone ?? "", payload.clientEmail ?? "", payload.summaryCase ?? "", payload.source || "Llamada de voz"]
  );

  // Solo al abogado derivado. Si no se puede identificar (o su correo no es válido), al aviso general del despacho.
  const lawyer = findLawyer(payload.lawyerName);
  const recipients = lawyer && isSendableLawyerEmail(lawyer.email) ? [lawyer.email] : [requireEnv("EMAIL_NOTIFY_TO")];

  await sendMail({
    to: recipients.join(", "),
    subject: "Nuevo caso derivado",
    html: renderDerivarEmail(payload, lawyer),
  });
}
