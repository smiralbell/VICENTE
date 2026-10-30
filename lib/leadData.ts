// Comprobaciones de los datos del cliente antes de guardar un lead y avisar al despacho (chat y agente de voz).

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

// Si el cliente ha dictado su correo y la IA lo ha puesto en el resumen pero no en su campo, se toma del resumen.
export function emailOrFromSummary(email: string, summary: string): string {
  const given = email.trim();
  if (EMAIL_RE.test(given)) return given;
  return summary.match(EMAIL_RE)?.[0] ?? given;
}
