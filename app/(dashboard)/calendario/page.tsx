import Link from "next/link";
import GestionFilter from "./GestionFilter";
import { getAppointments, type AppointmentRow } from "@/lib/db";
import { parseMadridLocal, madridDayKey, madridTime, formatMadrid } from "@/lib/dateFormat";
import { getGestionState, isGestionFilter } from "@/lib/leadFilters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODOS = [
  { key: "ambas", label: "Todas" },
  { key: "presencial", label: "Presenciales" },
  { key: "videoconferencia", label: "Meet" },
] as const;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Props = {
  searchParams: Promise<{ mes?: string; modo?: string; gestion?: string }>;
};

function currentMonthMadrid(): string {
  return madridDayKey(new Date()).slice(0, 7);
}

function shiftMonth(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isVideo(row: AppointmentRow): boolean {
  return (row.modalidad ?? "").trim().toLowerCase() === "videoconferencia";
}

function chipClass(row: AppointmentRow): string {
  return isVideo(row) ? "border-sky-200 bg-sky-50 text-sky-800" : "border-violet-200 bg-violet-50 text-violet-800";
}

export default async function CalendarioPage({ searchParams }: Props) {
  const params = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(params.mes ?? "") ? (params.mes as string) : currentMonthMadrid();
  const modo = MODOS.some((m) => m.key === params.modo) ? (params.modo as string) : "ambas";
  const gestion = isGestionFilter(params.gestion ?? "") ? (params.gestion as string) : "";

  const [y, m] = mes.split("-").map(Number);
  const from = parseMadridLocal(`01/${String(m).padStart(2, "0")}/${y} 00:00`);
  const next = shiftMonth(mes, 1).split("-").map(Number);
  const to = parseMadridLocal(`01/${String(next[1]).padStart(2, "0")}/${next[0]} 00:00`);
  if (!from || !to) throw new Error("Mes no válido");

  const rows = await getAppointments(from, to, modo === "ambas" ? "" : modo, gestion);

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
  const linkFor = (nextMes: string, nextModo: string, nextGestion: string) => {
    const q = new URLSearchParams({ mes: nextMes, modo: nextModo });
    if (nextGestion) q.set("gestion", nextGestion);
    return `/calendario?${q.toString()}`;
  };

  const counts = {
    total: rows.length,
    presencial: rows.filter((r) => !isVideo(r)).length,
    meet: rows.filter(isVideo).length,
  };

  return (
    <div className="w-full">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold capitalize text-paper-ink">{monthName}</h1>
          <p className="text-xs text-paper-muted">
            {counts.total} cita{counts.total === 1 ? "" : "s"} · {counts.presencial} presencial{counts.presencial === 1 ? "" : "es"} · {counts.meet} Meet
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-paper-border bg-paper-card p-1 shadow-sm">
            {MODOS.map((opt) => (
              <Link
                key={opt.key}
                href={linkFor(mes, opt.key, gestion)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${modo === opt.key ? "bg-brand text-white" : "text-paper-inkLight hover:bg-paper"}`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          <div className="inline-flex items-center gap-1">
            <Link href={linkFor(shiftMonth(mes, -1), modo, gestion)} className="rounded-xl border border-paper-border bg-paper-card px-3 py-2 text-sm shadow-sm hover:bg-paper" aria-label="Mes anterior">
              ←
            </Link>
            <Link href={linkFor(currentMonthMadrid(), modo, gestion)} className="rounded-xl border border-paper-border bg-paper-card px-3 py-2 text-sm shadow-sm hover:bg-paper">
              Mes actual
            </Link>
            <Link href={linkFor(shiftMonth(mes, 1), modo, gestion)} className="rounded-xl border border-paper-border bg-paper-card px-3 py-2 text-sm shadow-sm hover:bg-paper" aria-label="Mes siguiente">
              →
            </Link>
          </div>

          <GestionFilter mes={mes} modo={modo} current={gestion} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
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
                <div key={idx} className={`min-h-[110px] border-b border-r border-paper-border p-1.5 ${key ? "" : "bg-paper/60"}`}>
                  {key && (
                    <>
                      <div className={`mb-1 text-xs font-medium ${isToday ? "text-brand" : "text-paper-muted"}`}>{Number(key.slice(8))}</div>
                      <div className="space-y-1">
                        {items.slice(0, 3).map((row) => {
                          const gestionState = getGestionState(row.gestion_estado);
                          return (
                            <Link
                              key={row.id}
                              href={`/leads/${row.id}`}
                              title={`${row.name || row.phone || "Lead"}\n${gestionState.label}: ${gestionState.description}`}
                              className={`block truncate rounded-lg border px-1.5 py-1 text-[11px] leading-tight hover:shadow ${chipClass(row)}`}
                            >
                              <span className="font-semibold">{madridTime(new Date(row.cita_inicio))}</span> {row.name || row.phone || "Sin nombre"}
                            </Link>
                          );
                        })}
                        {items.length > 3 && <p className="text-[11px] text-paper-muted">+{items.length - 3} más</p>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="rounded-2xl border border-paper-border bg-paper-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-paper-ink">Citas del mes</h2>
          {rows.length === 0 && <p className="text-sm text-paper-muted">No hay citas con estos filtros.</p>}
          <ul className="space-y-2.5">
            {rows.map((row) => {
              const gestionState = getGestionState(row.gestion_estado);
              return (
                <li key={row.id}>
                  <Link href={`/leads/${row.id}`} className="block rounded-xl border border-paper-border p-3 transition-shadow hover:shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-paper-muted">{formatMadrid(row.cita_inicio)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isVideo(row) ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800"}`}>
                        {isVideo(row) ? "Meet" : "Presencial"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-paper-ink">{row.name || row.phone || "Sin nombre"}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${gestionState.className}`}>{gestionState.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-paper-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-400" /> Presencial</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Meet / videoconferencia</span>
      </div>
    </div>
  );
}

