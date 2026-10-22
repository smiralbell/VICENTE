import { getDashboardSettings } from "./db";

// Horario laboral del despacho, igual que la condición "If working hour" de n8n (hora de Madrid):
// lunes a jueves de 9:00 a 19:30, viernes de 9:00 a 15:00.
export function isWorkingHours(date: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const weekday = weekdays[get("weekday")] ?? 0;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  if (weekday < 1 || weekday > 5 || hour < 9) return false;
  if (weekday <= 4) return hour < 19 || (hour === 19 && minute <= 30);
  return hour < 15;
}

// El interruptor general. Afecta a todo: chat y llamadas.
export async function isSystemOn(): Promise<boolean> {
  const settings = await getDashboardSettings();
  return settings.systemPublished;
}

// Solo para llamadas: el sistema debe estar encendido y, en modo "solo fuera laboral",
// debe ser fuera del horario laboral. El chat no usa esta regla.
export async function isAiAvailable(now: Date = new Date()): Promise<boolean> {
  const settings = await getDashboardSettings();
  if (!settings.systemPublished) return false;
  if (settings.offWorkOnly && isWorkingHours(now)) return false;
  return true;
}
