// Rango de fechas compartido entre Leads, Conversaciones y Transcripciones.
// Se guarda en una cookie: si se elige en una página, las otras lo aplican también; la URL (?desde=&hasta=) manda sobre la cookie.

export const RANGE_COOKIE = "dashboard_rango";

export type DateRange = { from: string; to: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function valid(value: string | null | undefined): string {
  return value && DAY_RE.test(value) ? value : "";
}

export function parseRangeCookie(value: string | undefined | null): DateRange {
  const [from, to] = (value ?? "").split("_");
  return { from: valid(from), to: valid(to) };
}

export function rangeCookieValue(range: DateRange): string {
  return `${range.from}_${range.to}`;
}

// La URL manda; si no trae fechas, las de la cookie.
export function resolveRange(params: { desde?: string | null; hasta?: string | null }, cookie: string | undefined | null): DateRange {
  if (params.desde != null || params.hasta != null) return { from: valid(params.desde), to: valid(params.hasta) };
  return parseRangeCookie(cookie);
}

// Lado del navegador.
export function readRangeCookie(): DateRange {
  if (typeof document === "undefined") return { from: "", to: "" };
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${RANGE_COOKIE}=`));
  return parseRangeCookie(match ? decodeURIComponent(match.split("=")[1]) : "");
}

export function writeRangeCookie(range: DateRange): void {
  if (!range.from && !range.to) {
    document.cookie = `${RANGE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    return;
  }
  document.cookie = `${RANGE_COOKIE}=${encodeURIComponent(rangeCookieValue(range))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

// Día en hora de Madrid (AAAA-MM-DD) de una fecha, para comparar con el rango.
export function madridDay(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function inRange(value: string | Date | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const day = madridDay(value);
  if (!day) return false;
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}
