import nodemailer from "nodemailer";
import { requireEnv } from "./env";
import { query } from "./db";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? "587");
    transporter = nodemailer.createTransport({
      host: requireEnv("SMTP_HOST"),
      port,
      secure: port === 465,
      auth: {
        user: requireEnv("SMTP_USER"),
        pass: requireEnv("SMTP_PASSWORD"),
      },
    });
  }
  return transporter;
}

// Texto plano del correo, para leerlo y buscar en él sin abrir el HTML.
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d|li)>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

type EmailLog = { to: string; subject: string; html: string; bcc: string; estado: "enviado" | "fallido"; intentos: number; error?: string };

// Guarda cada correo en la base de datos (eliasymunozabogados_emails). Si el registro falla, el correo no se ve afectado.
async function logEmail(log: EmailLog): Promise<void> {
  try {
    await query(
      `INSERT INTO eliasymunozabogados_emails (estado, intentos, destinatarios, copia_oculta, asunto, texto, html, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [log.estado, log.intentos, log.to, log.bcc || null, log.subject, htmlToText(log.html), log.html, log.error ?? null]
    );
  } catch (error) {
    console.error("No se pudo guardar el correo en el registro", error);
  }
}

// Copia oculta de todos los correos, para revisar que llegan bien. Con EMAIL_COPY_TO vacío no se envía copia.
const DEFAULT_COPY_TO = "agenciabuffaloo@gmail.com";

// Fallos del servidor de correo como «Greeting never received» son pasajeros: se reintenta antes de rendirse.
const RETRY_DELAYS_MS = [2000, 6000];

export async function sendMail(params: { to: string; subject: string; html: string }): Promise<void> {
  const copyTo = (process.env.EMAIL_COPY_TO ?? DEFAULT_COPY_TO).trim();
  const message = {
    from: requireEnv("EMAIL_FROM"),
    to: params.to,
    bcc: copyTo || undefined,
    subject: params.subject,
    html: params.html,
  };
  for (let attempt = 0; ; attempt++) {
    try {
      await getTransporter().sendMail(message);
      await logEmail({ ...params, bcc: copyTo, estado: "enviado", intentos: attempt + 1 });
      return;
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        // El aviso de incidencia lleva el asunto y el destinatario para poder reenviarlo a mano.
        const reason = error instanceof Error ? error.message : String(error);
        await logEmail({ ...params, bcc: copyTo, estado: "fallido", intentos: attempt + 1, error: reason });
        throw new Error(`Correo NO enviado tras ${attempt + 1} intentos («${params.subject}» a ${params.to}): ${reason}`);
      }
      // Conexión nueva en el siguiente intento, por si la anterior quedó rota.
      transporter = null;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
