import { query, transaction } from "./db";
import { requireEnv } from "./env";
import { sendMail } from "./email";
import { formatMadrid } from "./dateFormat";

const LEADS_TABLE = "eliasymunozabogados_leads";
const NOTAS_TABLE = "eliasymunozabogados_lead_notas";

type Run = typeof query;

export type CitaFutura = { id: number; session_id: string | null; cita_inicio: Date; modalidad: string | null };

// Todo lo que toca las citas de un teléfono va en una transacción con un bloqueo por teléfono:
// dos peticiones a la vez (Retell repite a veces la herramienta) esperan una a la otra, y si algo falla
// a medias no se aplica nada (nunca queda la cita anterior anulada sin la nueva guardada).
export async function withCitasLock<T>(phone: string, fn: (run: Run) => Promise<T>): Promise<T> {
  return transaction(async (run) => {
    await run(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`citas:${phone}`]);
    return fn(run);
  });
}

// Citas futuras de una persona: las de los leads con su teléfono o su sesión, de la más próxima a la más lejana.
export async function getCitasFuturas(run: Run, phone: string, sessionId: string): Promise<CitaFutura[]> {
  const { rows } = await run<CitaFutura>(
    `SELECT id, session_id, cita_inicio, modalidad FROM ${LEADS_TABLE}
     WHERE (phone = $1 OR session_id = $1 OR session_id = $2) AND cita_inicio > NOW()
     ORDER BY cita_inicio ASC`,
    [phone, sessionId]
  );
  return rows;
}

export function sameTime(cita: CitaFutura, when: Date | null): boolean {
  return Boolean(when) && new Date(cita.cita_inicio).getTime() === when!.getTime();
}

// Anula citas: quita fecha y modalidad, el lead vuelve a pendiente y queda una nota en su ficha.
// Con nuevaCita, es un cambio de cita; sin ella (null), el cliente ha pedido anularla.
export async function anularCitas(run: Run, citas: CitaFutura[], nuevaCita: string | null): Promise<void> {
  for (const cita of citas) {
    await run(
      `UPDATE ${LEADS_TABLE} SET cita_inicio = NULL, fecha = NULL, modalidad = NULL,
         gestion_estado = CASE WHEN gestion_estado IN ('cita_pendiente', 'cita_confirmada') THEN 'pendiente' ELSE gestion_estado END
       WHERE id = $1`,
      [cita.id]
    );
    await run(`INSERT INTO ${NOTAS_TABLE} (lead_id, texto, autor) VALUES ($1, $2, $3)`, [
      cita.id,
      nuevaCita
        ? `Cita del ${formatMadrid(cita.cita_inicio)} anulada: el cliente la ha cambiado al ${nuevaCita}.`
        : `Cita del ${formatMadrid(cita.cita_inicio)} anulada: el cliente ha pedido anularla.`,
      "Sistema",
    ]);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const LABEL_CELL = 'style="padding:12px; background:#f7f7fb; border:1px solid #e5e7eb; font-weight:bold; color:#070b2a; width:140px;"';
const VALUE_CELL = 'style="padding:12px; border:1px solid #e5e7eb;"';

const value = (text?: string) => (text && text.trim() ? escapeHtml(text.trim()) : "No indicado");

type Cliente = { name: string; phone: string; email: string; modalidad?: string };

// Mismo diseño que el correo de nuevo lead. «dashboard» es el aviso destacado de qué se ha hecho ya en el Dashboard.
function renderCitaEmail(subtitle: string, intro: string, dashboard: { text: string; tone: "ok" | "aviso" }, middle: string, cliente: Cliente): string {
  const box =
    dashboard.tone === "ok"
      ? "background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46;"
      : "background:#fffbeb; border:1px solid #fcd34d; color:#92400e;";
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
              <p style="margin:8px 0 0; color:#d7d9e8; font-size:14px;">${escapeHtml(subtitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; line-height:1.6;">${intro}</p>
              <div style="${box} padding:14px 16px; border-radius:10px; margin-bottom:24px; line-height:1.5; font-size:14px;">
                <strong>Dashboard:</strong> ${dashboard.text}
              </div>
              ${middle}
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr><td ${LABEL_CELL}>Nombre</td><td ${VALUE_CELL}>${value(cliente.name)}</td></tr>
                <tr><td ${LABEL_CELL}>Teléfono</td><td ${VALUE_CELL}>${value(cliente.phone)}</td></tr>
                <tr><td ${LABEL_CELL}>Email</td><td ${VALUE_CELL}>${value(cliente.email)}</td></tr>
                ${cliente.modalidad !== undefined ? `<tr><td ${LABEL_CELL}>Modalidad</td><td ${VALUE_CELL}>${value(cliente.modalidad)}</td></tr>` : ""}
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f7f7fb; padding:18px 32px; text-align:center; color:#6b7280; font-size:12px;">
              Este mensaje ha sido generado automáticamente por el asistente de IA. Es informativo: lo indicado en «Dashboard» ya está hecho.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function citasBlock(label: string, dates: Date[], style: string): string {
  const list = dates.map((date) => escapeHtml(formatMadrid(date))).join("<br/>");
  return `<div style="padding:16px; background:#f7f7fb; border:1px solid #e5e7eb; border-radius:10px; text-align:center; margin-bottom:24px;">
                <p style="margin:0; font-size:13px; color:#6b7280;">${label}</p>
                <p style="margin:6px 0 0; font-size:18px; font-weight:bold; ${style}">${list}</p>
              </div>`;
}

export type CitaModificada = Cliente & {
  modalidad: string;
  antes: Date[];
  ahora: string;
  canal: string;
  // true cuando quiso cambiar su cita pero tenía varias y no se sabe cuál: no se anula ninguna y se revisa a mano.
  revisar?: boolean;
};

// Para que el despacho vea de un vistazo de qué día a qué día ha cambiado y que el Dashboard ya está al día.
function renderCitaModificadaEmail(cita: CitaModificada): string {
  const antes = cita.antes.map((date) => escapeHtml(formatMadrid(date))).join("<br/>");
  const intro = cita.revisar
    ? `<strong>${value(cita.name)}</strong> ha pedido cambiar su cita (${escapeHtml(cita.canal)}), pero tiene varias citas pendientes y no se sabe cuál quiere cambiar.`
    : `<strong>${value(cita.name)}</strong> ha cambiado su cita (${escapeHtml(cita.canal)}). Solo es válida la nueva.`;
  const dashboard = cita.revisar
    ? { text: "la nueva cita ya está en el calendario, pero <strong>no se ha anulado ninguna de las anteriores</strong>. Revisad cuál hay que quitar.", tone: "aviso" as const }
    : { text: "ya está actualizado. La cita anterior se ha quitado del calendario y la nueva ya aparece. No hay que hacer nada más en el Dashboard.", tone: "ok" as const };
  const antesLabel = cita.revisar ? "Citas que ya tenía (sin anular)" : "Cita anterior (anulada)";
  const antesStyle = cita.revisar ? "color:#070b2a;" : "color:#6b7280; text-decoration:line-through;";
  const middle = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:16px; background:#f7f7fb; border:1px solid #e5e7eb; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#6b7280;">${antesLabel}</p>
                    <p style="margin:6px 0 0; font-size:18px; font-weight:bold; ${antesStyle}">${antes}</p>
                  </td>
                  <td width="50%" style="padding:16px; background:#070b2a; border:1px solid #070b2a; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#d7d9e8;">Nueva cita</p>
                    <p style="margin:6px 0 0; font-size:18px; font-weight:bold; color:#ffffff;">${value(cita.ahora)}</p>
                  </td>
                </tr>
              </table>`;
  return renderCitaEmail("Cita modificada desde el asistente de IA", intro, dashboard, middle, cita);
}

export async function sendCitaModificadaEmail(cita: CitaModificada): Promise<void> {
  await sendMail({
    to: requireEnv("EMAIL_NOTIFY_TO"),
    subject: `${cita.revisar ? "REVISAR CAMBIO DE CITA" : "CITA MODIFICADA"}: ${cita.name || cita.phone}`,
    html: renderCitaModificadaEmail(cita),
  });
}

// Resultado de una petición de anular cita: anulada en el Dashboard, varias (se revisa a mano) o ninguna en el sistema.
export type AnulacionResult = "anulada" | "revisar" | "no_encontrada";

type CitaAnulada = Cliente & { resultado: AnulacionResult; citas: Date[]; canal: string };

function renderCitaAnuladaEmail(cita: CitaAnulada): string {
  const quien = `<strong>${value(cita.name)}</strong>`;
  if (cita.resultado === "anulada") {
    return renderCitaEmail(
      "Cita anulada desde el asistente de IA",
      `${quien} ha pedido anular su cita (${escapeHtml(cita.canal)}).`,
      { text: "la cita ya está anulada y se ha quitado del calendario. No hay que hacer nada más en el Dashboard.", tone: "ok" },
      citasBlock("Cita anulada", cita.citas, "color:#6b7280; text-decoration:line-through;"),
      cita
    );
  }
  if (cita.resultado === "revisar") {
    return renderCitaEmail(
      "Petición de anular cita desde el asistente de IA",
      `${quien} ha pedido anular su cita (${escapeHtml(cita.canal)}), pero tiene varias citas pendientes y no se sabe cuál.`,
      { text: "<strong>no se ha anulado ninguna</strong>. Revisad con el cliente cuál quiere anular y quitadla del calendario.", tone: "aviso" },
      citasBlock("Citas que tiene (sin anular)", cita.citas, "color:#070b2a;"),
      cita
    );
  }
  return renderCitaEmail(
    "Petición de anular cita desde el asistente de IA",
    `${quien} ha pedido anular una cita (${escapeHtml(cita.canal)}).`,
    { text: "esta persona <strong>no tiene ninguna cita en el Dashboard</strong>, así que no se ha anulado nada. Será una cita de la agenda del despacho: anuladla a mano.", tone: "aviso" },
    "",
    cita
  );
}

const ANULACION_SUBJECT: Record<AnulacionResult, string> = {
  anulada: "CITA ANULADA",
  revisar: "REVISAR ANULACIÓN DE CITA",
  no_encontrada: "SOLICITUD DE ANULACIÓN DE CITA",
};

// El cliente pide anular su cita (por llamada o por chat). Si tiene una sola cita futura, se anula; si tiene varias, no se toca
// ninguna; si no tiene ninguna en el sistema, es de la agenda del despacho. En los tres casos se avisa al despacho.
export async function anularCitaSolicitada(input: { phone: string; sessionId: string; name: string; email: string; canal: string }): Promise<AnulacionResult> {
  const outcome = await withCitasLock(input.phone, async (run) => {
    const futuras = await getCitasFuturas(run, input.phone, input.sessionId);
    if (futuras.length === 1) await anularCitas(run, futuras, null);
    const lead = (await run<{ name: string | null; email: string | null }>(
      `SELECT name, email FROM ${LEADS_TABLE} WHERE phone = $1 OR session_id = $1 OR session_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [input.phone, input.sessionId]
    )).rows[0];
    const resultado: AnulacionResult = futuras.length === 1 ? "anulada" : futuras.length > 1 ? "revisar" : "no_encontrada";
    return { resultado, futuras, lead };
  });
  await sendMail({
    to: requireEnv("EMAIL_NOTIFY_TO"),
    subject: `${ANULACION_SUBJECT[outcome.resultado]}: ${input.name || outcome.lead?.name || input.phone}`,
    html: renderCitaAnuladaEmail({
      resultado: outcome.resultado,
      citas: outcome.futuras.map((cita) => cita.cita_inicio),
      canal: input.canal,
      name: input.name || outcome.lead?.name || "",
      phone: input.phone,
      email: input.email || outcome.lead?.email || "",
      modalidad: outcome.resultado === "anulada" ? outcome.futuras[0].modalidad ?? "" : undefined,
    }),
  });
  return outcome.resultado;
}

