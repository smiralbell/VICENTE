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

export async function sendMail(params: { to: string; subject: string; html: string }): Promise<void> {
  const copyTo = (process.env.EMAIL_COPY_TO ?? DEFAULT_COPY_TO).trim();
  await getTransporter().sendMail({
    from: requireEnv("EMAIL_FROM"),
    to: params.to,
    bcc: copyTo || undefined,
    subject: params.subject,
    html: params.html,
  });
}
