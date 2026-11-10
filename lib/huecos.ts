import { query } from "./db";
import { parseMadridLocal } from "./dateFormat";

// Huecos libres para citas. Una sola consulta a la base de datos (milisegundos): se calcula al empezar la llamada
// y va en las variables de Retell, así el agente propone horas libres sin usar ninguna herramienta (sin latencia).
// Al agendar se comprueba otra vez por si alguien ha cogido esa hora entre medias.

const LEADS_TABLE = "eliasymunozabogados_leads";
// Cuántas citas caben a la vez en la misma hora (por defecto 1).
const POR_HUECO = Math.max(1, Number(process.env.CITAS_POR_HUECO) || 1);
// Una cita ocupa la hora entera: una a las 16:30 bloquea las 16:00 y las 17:00.
const DURACION_MS = 60 * 60 * 1000;
// No se ofrece una hora que empieza en menos de 2 horas.
const MARGEN_MS = 2 * 60 * 60 * 1000;
const DIAS = 6;

const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" });
const DAY_PARTS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_NAME = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" });
const HOUR = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

// Horas de cita: lunes a jueves de 9 a 18, viernes de 9 a 13 (en punto).
function horasDelDia(weekday: number): number[] {
  if (weekday >= 1 && weekday <= 4) return [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  if (weekday === 5) return [9, 10, 11, 12, 13];
  return [];
}

type Ocupada = { cita_inicio: Date; phone: string | null; session_id: string | null };

const digits = (text: string | null | undefined) => (text ?? "").replace(/\D/g, "").slice(-9);

// Las citas de la propia persona no le quitan el hueco (repetir la misma cita o cambiarla).
function deOtro(cita: Ocupada, phone?: string, sessionId?: string): boolean {
  if (phone && digits(phone).length === 9 && digits(cita.phone) === digits(phone)) return false;
  if (sessionId && cita.session_id && (cita.session_id === sessionId || cita.session_id.startsWith(`${sessionId}#`))) return false;
  return true;
}

async function citasEntre(desde: Date, hasta: Date): Promise<Ocupada[]> {
  const { rows } = await query<Ocupada>(
    `SELECT cita_inicio, phone, session_id FROM ${LEADS_TABLE} WHERE cita_inicio > $1 AND cita_inicio < $2`,
    [new Date(desde.getTime() - DURACION_MS).toISOString(), new Date(hasta.getTime() + DURACION_MS).toISOString()]
  );
  return rows;
}

function lleno(when: Date, citas: Ocupada[], phone?: string, sessionId?: string): boolean {
  const solapan = citas.filter((c) => deOtro(c, phone, sessionId) && Math.abs(new Date(c.cita_inicio).getTime() - when.getTime()) < DURACION_MS);
  return solapan.length >= POR_HUECO;
}

// ¿Esa hora ya la tiene otra persona? Si no se puede comprobar, se deja agendar (mejor una cita de más que perderla).
export async function huecoOcupado(when: Date, phone?: string, sessionId?: string): Promise<boolean> {
  try {
    return lleno(when, await citasEntre(when, when), phone, sessionId);
  } catch {
    return false;
  }
}

type Dia = { nombre: string; fecha: string; horas: Date[] };

async function diasLibres(now: Date = new Date()): Promise<Dia[]> {
  const dias: Dia[] = [];
  for (let i = 0; i < 15 && dias.length < DIAS; i++) {
    const day = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const horas = horasDelDia(WEEKDAYS[WEEKDAY.format(day)] ?? 0);
    if (!horas.length) continue;
    const [y, m, d] = DAY_PARTS.format(day).split("-");
    const fecha = `${d}/${m}/${y}`;
    const slots = horas
      .map((h) => parseMadridLocal(`${fecha} ${String(h).padStart(2, "0")}:00`))
      .filter((w): w is Date => w !== null && w.getTime() >= now.getTime() + MARGEN_MS);
    if (slots.length) dias.push({ nombre: DAY_NAME.format(day), fecha, horas: slots });
  }
  if (!dias.length) return dias;
  const ultimo = dias[dias.length - 1].horas;
  const citas = await citasEntre(dias[0].horas[0], ultimo[ultimo.length - 1]);
  return dias.map((dia) => ({ ...dia, horas: dia.horas.filter((w) => !lleno(w, citas)) })).filter((dia) => dia.horas.length);
}

const hora = (w: Date) => HOUR.format(w).replace(/^0/, "");

// Texto para el agente: «lunes 16/11/2026: 9:00, 10:00, 12:00 | martes 17/11/2026: ...». Vacío si falla.
export async function huecosLibresTexto(now: Date = new Date()): Promise<string> {
  try {
    const dias = await diasLibres(now);
    return dias.map((dia) => `${dia.nombre} ${dia.fecha}: ${dia.horas.map(hora).join(", ")}`).join(" | ");
  } catch {
    return "";
  }
}

// Unas pocas horas libres para ofrecer cuando la pedida está ocupada (las de ese día primero).
export async function alternativas(when: Date): Promise<string> {
  try {
    const dias = await diasLibres();
    const key = DAY_PARTS.format(when);
    const orden = [...dias.filter((d) => d.horas.some((h) => DAY_PARTS.format(h) === key)), ...dias.filter((d) => !d.horas.some((h) => DAY_PARTS.format(h) === key))];
    return orden.flatMap((d) => d.horas.map((h) => `${d.nombre} ${d.fecha} a las ${hora(h)}`)).slice(0, 4).join("; ");
  } catch {
    return "";
  }
}
