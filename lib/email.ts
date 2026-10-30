import nodemailer from "nodemailer";
import { requireEnv } from "./env";

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
      return;
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        // El aviso de incidencia lleva el asunto y el destinatario para poder reenviarlo a mano.
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Correo NO enviado tras ${attempt + 1} intentos («${params.subject}» a ${params.to}): ${reason}`);
      }
      // Conexión nueva en el siguiente intento, por si la anterior quedó rota.
      transporter = null;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
