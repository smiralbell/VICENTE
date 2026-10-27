import { addLeadNota, query } from "./db";
import { requireEnv } from "./env";
import { sendMail } from "./email";
import { formatMadrid } from "./dateFormat";

const LEADS_TABLE = "eliasymunozabogados_leads";

export type CitaFutura = { id: number; session_id: string | null; cita_inicio: Date };

// Citas futuras de una persona: las de los leads con su teléfono o su sesión.
// Sin "when", todas; con "when", todas menos la de esa fecha y hora (que es la nueva).
export async function getCitasFuturas(phone: string, sessionId: string, when: Date | null): Promise<CitaFutura[]> {
  const { rows } = await query<CitaFutura>(
    `SELECT id, session_id, cita_inicio FROM ${LEADS_TABLE}
     WHERE (phone = $1 OR session_id = $1 OR session_id = $2) AND cita_inicio > NOW()
     ORDER BY cita_inicio ASC`,
    [phone, sessionId]
  );
  return when ? rows.filter((row) => new Date(row.cita_inicio).getTime() !== when.getTime()) : rows;
}

// Anula las citas que el cliente ha cambiado por otra: quita fecha y modalidad, el lead vuelve a pendiente
// y queda una nota en su ficha.
export async function anularCitas(citas: CitaFutura[], nuevaCita: string): Promise<void> {
  for (const cita of citas) {
    await query(
      `UPDATE ${LEADS_TABLE} SET cita_inicio = NULL, fecha = NULL, modalidad = NULL,
         gestion_estado = CASE WHEN gestion_estado IN ('cita_pendiente', 'cita_confirmada') THEN 'pendiente' ELSE gestion_estado END
       WHERE id = $1`,
      [cita.id]
    );
    await addLeadNota(cita.id, `Cita del ${formatMadrid(cita.cita_inicio)} anulada: el cliente la ha cambiado al ${nuevaCita}.`, "Sistema");
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const LABEL_CELL = 'style="padding:12px; background:#f7f7fb; border:1px solid #e5e7eb; font-weight:bold; color:#070b2a; width:140px;"';
const VALUE_CELL = 'style="padding:12px; border:1px solid #e5e7eb;"';

export type CitaModificada = {
  name: string;
  phone: string;
  email: string;
  modalidad: string;
  antes: Date[];
  ahora: string;
  canal: string;
};

// Mismo diseño que el correo de nuevo lead, para que el despacho vea de un vistazo de qué día a qué día ha cambiado.
function renderCitaModificadaEmail(cita: CitaModificada): string {
  const value = (text?: string) => (text && text.trim() ? escapeHtml(text.trim()) : "No indicado");
  const antes = cita.antes.map((date) => escapeHtml(formatMadrid(date))).join("<br/>");

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
              <p style="margin:8px 0 0; color:#d7d9e8; font-size:14px;">Cita modificada desde el asistente de IA</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px; line-height:1.6;">
                <strong>${value(cita.name)}</strong> ha cambiado su cita (${escapeHtml(cita.canal)}). La cita anterior queda anulada y solo es válida la nueva.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:16px; background:#f7f7fb; border:1px solid #e5e7eb; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#6b7280;">Cita anterior (anulada)</p>
                    <p style="margin:6px 0 0; font-size:18px; font-weight:bold; color:#6b7280; text-decoration:line-through;">${antes}</p>
                  </td>
                  <td width="50%" style="padding:16px; background:#070b2a; border:1px solid #070b2a; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#d7d9e8;">Nueva cita</p>
                    <p style="margin:6px 0 0; font-size:18px; font-weight:bold; color:#ffffff;">${value(cita.ahora)}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr><td ${LABEL_CELL}>Nombre</td><td ${VALUE_CELL}>${value(cita.name)}</td></tr>
                <tr><td ${LABEL_CELL}>Teléfono</td><td ${VALUE_CELL}>${value(cita.phone)}</td></tr>
                <tr><td ${LABEL_CELL}>Email</td><td ${VALUE_CELL}>${value(cita.email)}</td></tr>
                <tr><td ${LABEL_CELL}>Modalidad</td><td ${VALUE_CELL}>${value(cita.modalidad)}</td></tr>
              </table>
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

export async function sendCitaModificadaEmail(cita: CitaModificada): Promise<void> {
  await sendMail({
    to: requireEnv("EMAIL_NOTIFY_TO"),
    subject: `CITA MODIFICADA: ${cita.name || cita.phone}`,
    html: renderCitaModificadaEmail(cita),
  });
}
