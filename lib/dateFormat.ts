// Todas las fechas del dashboard se muestran en hora de Madrid, con independencia
// de la zona horaria del navegador o del servidor.
const MADRID_FORMAT = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatMadrid(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const parts = MADRID_FORMAT.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

// Convierte "dd/mm/aaaa hh:mm" (hora de Madrid) en un instante real. Devuelve null si no encaja.
export function parseMadridLocal(text: string | null | undefined): Date | null {
  const m = (text ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, day, month, year, hour, minute] = m.map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const guess = new Date(wall);
  const parts = MADRID_FORMAT.formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const madridAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = madridAsUtc - Math.floor(guess.getTime() / 60000) * 60000;
  return new Date(wall - offset);
}
