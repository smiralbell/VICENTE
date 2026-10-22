import Link from "next/link";
import { getAppointments, type AppointmentRow } from "@/lib/db";
import { parseMadridLocal, madridDayKey, madridTime } from "@/lib/dateFormat";
import { getGestionState } from "@/lib/leadFilters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODOS = [
  { key: "ambas", label: "Todas" },
  { key: "presencial", label: "Presenciales" },
  { key: "videoconferencia", label: "Meet" },
] as const;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Props = {
  searchParams: Promise<{ mes?: string; modo?: string }>;
};

function currentMonthMadrid(): string {
  const key = madridDayKey(new Date());
  return key.slice(0, 7);
}

function shiftMonth(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function chipClass(row: AppointmentRow): string {
  const video = (row.modalidad ?? "").trim().toLowerCase() === "videoconferencia";
  return video
    ? "border-sky-200 bg-sky-50 text-sky-800"
    : "border-violet-200 bg-violet-50 text-violet-800";
}

export default async function CalendarioPage({ searchParams }: Props) {
  const params = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(params.mes ?? "") ? (params.mes as string) : currentMonthMadrid();
  const modo = MODOS.some((m) => m.key === params.modo) ? (params.modo as string) : "ambas";

  const [y, m] = mes.split("-").map(Number);
  const from = parseMadridLocal(`01/${String(m).padStart(2, "0")}/${y} 00:00`);
  const next = shiftMonth(mes, 1).split("-").map(Number);
  const to = parseMadridLocal(`01/${String(next[1]).padStart(2, "0")}/${next[0]} 00:00`);
  if (!from || !to) throw new Error("Mes no válido");

  const rows = await getAppointments(from, to, modo === "ambas" ? "" : modo);

  const byDay = new Map<string, AppointmentRow[]>();
  for (const row of rows) {
    const key = madridDayKey(new Date(row.cita_inicio));
    byDay.set(key, [...(byDay.get(key) ?? []), row]);
  }

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
  const today = madridDayKey(new Date());

  const linkFor = (nextMes: string, nextModo: string) => `/calendario?mes=${nextMes}&modo=${nextModo}`;

  return (
    <div className="w-full">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold capitalize text-paper-ink">{monthName}</h1>
          <p className="text-xs text-paper-muted">{rows.length} cita{rows.length === 1 ? "" : "s"} este mes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-paper-border bg-paper-card p-1 shadow-sm">
            {MODOS.map((opt) => (
              <Link
                key={opt.key}
                href={linkFor(mes, opt.key)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  modo === opt.key ? "bg-brand text-white" : "text-paper-inkLight hover:bg-paper"
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
          <div className="inline-flex items-center gap-1">
            <Link href={linkFor(shiftMonth(mes, -1), modo)} className="rounded-xl border border-paper-border bg-paper-card px-3 py-2 text-sm shadow-sm hover:bg-paper" aria-label="Mes anterior">
              ←
            </Link>
            <Link href={linkFor(currentMonthMadrid(), modo)} className="rounded-xl border border-paper-border bg-paper-card px-3 py-2 text-sm shadow-sm hover:bg-paper">
              Hoy
            </Link>
            <Link href={linkFor(shiftMonth(mes, 1), modo)} className="rounded-xl border border-paper-border bg-paper-card px-3 py-2 text-sm shadow-sm hover:bg-paper" aria-label="Mes siguiente">
              →
            </Link>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-paper-border bg-paper-card shadow-sm">
        <div className="grid grid-cols-7 border-b border-paper-border bg-paper text-xs font-medium text-paper-muted">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((key, idx) => {
            const items = key ? byDay.get(key) ?? [] : [];
            const isToday = key === today;
            return (
              <div
                key={idx}
                className={`min-h-[110px] border-b border-r border-paper-border p-1.5 ${key ? "" : "bg-paper/60"}`}
              >
                {key && (
                  <>
                    <div className={`mb-1 text-xs font-medium ${isToday ? "text-brand" : "text-paper-muted"}`}>
                      {Number(key.slice(8))}
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 4).map((row) => {
                        const gestion = getGestionState(row.gestion_estado);
                        return (
                          <Link
                            key={row.id}
                            href={`/leads/${row.id}`}
                            title={`${row.name || row.phone || "Lead"} · ${gestion.label}\n${gestion.description}`}
                            className={`block truncate rounded-lg border px-1.5 py-1 text-[11px] leading-tight transition-shadow hover:shadow ${chipClass(row)}`}
                          >
                            <span className="font-semibold">{madridTime(new Date(row.cita_inicio))}</span>{" "}
                            {row.name || row.phone || "Sin nombre"}
                          </Link>
                        );
                      })}
                      {items.length > 4 && <p className="text-[11px] text-paper-muted">+{items.length - 4} más</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-paper-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-400" /> Presencial</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Meet / videoconferencia</span>
        <span>Pasa el cursor sobre una cita para ver su estado de gestión.</span>
      </div>
    </div>
  );
}
