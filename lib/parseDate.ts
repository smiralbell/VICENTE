export function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const hours = Number(match[4] ?? "0");
  const minutes = Number(match[5] ?? "0");
  const seconds = Number(match[6] ?? "0");

  const parsed = new Date(year, month, day, hours, minutes, seconds);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function datesMatch(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): boolean {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return false;

  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate() &&
    da.getHours() === db.getHours() &&
    da.getMinutes() === db.getMinutes()
  );
}

export function dateDistanceMs(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number | null {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return null;
  return Math.abs(da.getTime() - db.getTime());
}

export function pickBestByDate<T extends { fecha: Date | string | null }>(
  items: T[],
  target: Date | string | null | undefined
): T | null {
  if (items.length === 0) return null;
  if (!target) return items[0];

  const exact = items.find((item) => datesMatch(target, item.fecha));
  if (exact) return exact;

  let best: T | null = null;
  let bestDistance: number | null = null;

  for (const item of items) {
    const distance = dateDistanceMs(target, item.fecha);
    if (distance === null) continue;
    if (bestDistance === null || distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }

  return best ?? items[0];
}
