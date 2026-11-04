// Comprobaciones de los datos del cliente antes de guardar un lead y avisar al despacho (chat y agente de voz).
import { query } from "./db";
import { validatePhone } from "./phone";

// Lo que la IA escribe cuando el cliente no quiere dar su nombre: se acepta, para no dejarle sin atender.
export const NAME_REFUSED = "No lo ha facilitado";

// Textos de relleno o genéricos que la IA a veces pone en lugar del nombre real.
const PLACEHOLDER_NAME = /^(\[.*\]|\{\{.*\}\}|-+|n\/?a|null|undefined|no indicado|desconocido|sin nombre|usuario|cliente|clienta|cliente del despacho|clienta del despacho|cliente nuevo|nuevo cliente|abogad[oa] contrari[oa]|(el|la) abogad[oa] contrari[oa]|proveedor|particular)$/i;

export function isRealName(name: string): boolean {
  const text = name.trim();
  if (text.toLowerCase() === NAME_REFUSED.toLowerCase()) return true;
  return text.length >= 2 && !PLACEHOLDER_NAME.test(text);
}

export const ASK_NAME =
  "Falta el nombre del cliente. Pídeselo de forma natural, por ejemplo: «¿Me indica su nombre, por favor?», y vuelve a usar la herramienta con su nombre real. " +
  `Si no quiere darlo, vuelve a usarla con el nombre «${NAME_REFUSED}». No pongas «Cliente del despacho» ni otros textos en lugar del nombre, y no hables de fallos.`;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

// El primer nombre real de la lista (lo que dijo el cliente, las variables de la llamada, el chat, el lead...).
export function pickName(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    const name = (candidate ?? "").trim();
    if (name && !/^\{\{.*\}\}$/.test(name) && isRealName(name) && name.toLowerCase() !== NAME_REFUSED.toLowerCase()) return name;
  }
  // Si ninguno es un nombre real pero el cliente dijo que no quería darlo, se respeta.
  return candidates.map((c) => (c ?? "").trim()).find((c) => c.toLowerCase() === NAME_REFUSED.toLowerCase()) ?? "";
}

// El primer email válido de la lista.
export function pickEmail(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    const email = (candidate ?? "").trim();
    if (EMAIL_RE.test(email) && !/^\{\{.*\}\}$/.test(email)) return email.match(EMAIL_RE)![0];
  }
  return "";
}

// Nombre y email que ya tenemos de esta persona en algún lead con su teléfono (p. ej. los del formulario web),
// para que ningún correo al despacho salga sin ellos aunque la IA no los rellene.
export async function knownContact(phone: string): Promise<{ name: string; email: string }> {
  const normalized = validatePhone(phone).phone || phone;
  const digits = normalized.replace(/\D/g, "").slice(-9);
  if (digits.length < 9) return { name: "", email: "" };
  const { rows } = await query<{ name: string | null; email: string | null }>(
    `SELECT name, email FROM eliasymunozabogados_leads
     WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE $1 ORDER BY created_at DESC`,
    [`%${digits}`]
  );
  return { name: pickName(...rows.map((r) => r.name)), email: pickEmail(...rows.map((r) => r.email)) };
}

// Si el cliente ha dictado su correo y la IA lo ha puesto en el resumen pero no en su campo, se toma del resumen.
export function emailOrFromSummary(email: string, summary: string): string {
  const given = email.trim();
  if (EMAIL_RE.test(given)) return given;
  return summary.match(EMAIL_RE)?.[0] ?? given;
}
