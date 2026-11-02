import { requireEnv } from "./env";
import { sendMail } from "./email";
import { formatMadrid } from "./dateFormat";

// Avisos al despacho cuando algo llega y la IA NO lo atiende (sistema apagado, horario laboral o número extranjero).
// Van en GRIS, no con el azul de siempre, para que se vea de un vistazo que hay que atenderlo a mano.

export type MotivoAviso = "sistema_apagado" | "horario_laboral" | "extranjero";
export type CanalAviso = "formulario" | "llamada" | "widget";

export type Aviso = {
  motivo: MotivoAviso;
  canal: CanalAviso;
  name?: string;
  phone?: string;
  email?: string;
  mensaje?: string;
  // Texto extra opcional (p. ej. «ahora ha dejado su teléfono»).
  nota?: string;
};

const MOTIVO: Record<MotivoAviso, { banner: string; detalle: string }> = {
  sistema_apagado: {
    banner: "La IA está desactivada",
    detalle: "El sistema está apagado desde el Dashboard, así que la IA no lo ha atendido.",
  },
  horario_laboral: {
    banner: "Horario laboral: la IA no atiende llamadas",
    detalle: "Está activo el modo «solo fuera de horario» y es horario laboral, así que la IA no ha cogido la llamada.",
  },
  extranjero: {
    banner: "Número de fuera de España",
    detalle: "El teléfono no es español y el sistema no llama a otros países, así que la IA no ha llamado.",
  },
};

const CANAL: Record<CanalAviso, { titulo: string; accion: string; asunto: string }> = {
  formulario: { titulo: "Formulario recibido", accion: "ha rellenado el formulario de la web", asunto: "FORMULARIO SIN ATENDER" },
  llamada: { titulo: "Llamada sin atender", accion: "ha llamado al despacho", asunto: "LLAMADA SIN ATENDER" },
  widget: { titulo: "Mensaje en el chat de la web", accion: "ha escrito en el chat de la web", asunto: "MENSAJE EN EL CHAT SIN ATENDER" },
};

const SUBJECT_REASON: Record<MotivoAviso, string> = {
  sistema_apagado: "IA DESACTIVADA",
  horario_laboral: "HORARIO LABORAL",
  extranjero: "NÚMERO EXTRANJERO",
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const LABEL_CELL = 'style="padding:12px; background:#f3f4f6; border:1px solid #e5e7eb; font-weight:bold; color:#374151; width:140px;"';
const VALUE_CELL = 'style="padding:12px; border:1px solid #e5e7eb;"';

function renderAviso(aviso: Aviso): string {
  const value = (text?: string) => (text && text.trim() ? escapeHtml(text.trim()) : "No indicado");
  const motivo = MOTIVO[aviso.motivo];
  const canal = CANAL[aviso.canal];
  const quien = aviso.name?.trim() ? `<strong>${escapeHtml(aviso.name.trim())}</strong>` : "Alguien";
  const mensaje = aviso.mensaje?.trim()
    ? `<div style="background:#f3f4f6; border-left:4px solid #6b7280; padding:18px 20px; border-radius:8px; margin-top:24px;">
                <p style="margin:0 0 8px; font-weight:bold; color:#374151;">${aviso.canal === "widget" ? "Lo que ha escrito:" : "Mensaje:"}</p>
                <p style="margin:0; line-height:1.6; color:#374151;">${escapeHtml(aviso.mensaje.trim()).replace(/\n/g, "<br/>")}</p>
              </div>`
    : "";
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0; padding:0; background-color:#e5e7eb; font-family:Arial, sans-serif; color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#4b5563; padding:28px 32px; text-align:center;">
              <a href="https://www.eliasymunozabogados.com/" target="_blank" style="text-decoration:none;">
                <img src="https://www.eliasymunozabogados.com/themes/eliasymunoz/logo.svg" alt="G. Elías y Muñoz Abogados" width="220" style="display:block; margin:0 auto 18px; width:220px; max-width:220px; height:auto; border:0;" />
              </a>
              <p style="margin:8px 0 0; color:#e5e7eb; font-size:14px;">${escapeHtml(canal.titulo)} · sin atender por la IA</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="background:#6b7280; color:#ffffff; padding:16px 18px; border-radius:10px; text-align:center; margin-bottom:24px;">
                <p style="margin:0; font-size:18px; font-weight:bold;">${escapeHtml(motivo.banner)}</p>
                <p style="margin:6px 0 0; font-size:13px; color:#e5e7eb;">${escapeHtml(motivo.detalle)}</p>
              </div>
              <p style="margin:0 0 20px; line-height:1.6;">
                ${quien} ${escapeHtml(canal.accion)} el ${escapeHtml(formatMadrid(new Date()))}. <strong>Os avisamos para que le atendáis vosotros.</strong>
                ${aviso.nota ? `<br/>${escapeHtml(aviso.nota)}` : ""}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr><td ${LABEL_CELL}>Nombre</td><td ${VALUE_CELL}>${value(aviso.name)}</td></tr>
                <tr><td ${LABEL_CELL}>Teléfono</td><td ${VALUE_CELL}>${value(aviso.phone)}</td></tr>
                <tr><td ${LABEL_CELL}>Email</td><td ${VALUE_CELL}>${value(aviso.email)}</td></tr>
              </table>
              ${mensaje}
            </td>
          </tr>
          <tr>
            <td style="background:#f3f4f6; padding:18px 32px; text-align:center; color:#6b7280; font-size:12px;">
              Este mensaje ha sido generado automáticamente porque la IA no ha atendido este contacto.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAviso(aviso: Aviso): Promise<void> {
  const quien = aviso.name?.trim() || aviso.phone?.trim() || aviso.email?.trim() || "sin datos";
  await sendMail({
    to: requireEnv("EMAIL_NOTIFY_TO"),
    subject: `${CANAL[aviso.canal].asunto} · ${SUBJECT_REASON[aviso.motivo]}: ${quien}`,
    html: renderAviso(aviso),
  });
}
