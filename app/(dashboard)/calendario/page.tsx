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
  searchParams: Promise<{ mes?: string; modo?: string; gestion?: string; dia?: string }>;
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
  const linkFor = (nextMes: string, nextModo: string, nextGestion: string, nextDia = "") => {
    const q = new URLSearchParams({ mes: nextMes, modo: nextModo });
    if (nextGestion) q.set("gestion", nextGestion);
    if (nextDia) q.set("dia", nextDia);
    return `/calendario?${q.toString()}`;
  };

  // Día abierto: muestra todas sus citas debajo del calendario (en la celda solo caben 3).
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(params.dia ?? "") && params.dia!.startsWith(mes) ? params.dia! : "";
  const diaItems = dia ? byDay.get(dia) ?? [] : [];
  const diaText = dia
    ? new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    : "";
  const diaLabel = diaText.charAt(0).toUpperCase() + diaText.slice(1);

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

      <div>
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
              const isOpen = key === dia;
              // Días ya pasados: en gris y sin color, para distinguirlos de los que vienen.
              const isPast = Boolean(key && key < today);
              return (
                <div
                  key={idx}
                  className={`min-h-[110px] border-b border-r border-paper-border p-1.5 ${key ? "" : "bg-paper/60"} ${isPast && !isOpen ? "bg-zinc-50 opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0" : ""} ${isOpen ? "bg-brand-subtle ring-2 ring-inset ring-brand" : ""}`}
                >
                  {key && (
                    <>
                      {items.length > 0 ? (
                        <Link
                          href={isOpen ? linkFor(mes, modo, gestion) : `${linkFor(mes, modo, gestion, key)}#citas-del-dia`}
                          className={`mb-1 flex items-center justify-between rounded px-0.5 text-xs font-medium hover:bg-paper ${isToday ? "text-brand" : "text-paper-muted"}`}
                          title="Ver todas las citas del día"
                        >
                          <span>{Number(key.slice(8))}</span>
                          <span className="text-[10px] font-normal">{items.length} cita{items.length === 1 ? "" : "s"}</span>
                        </Link>
                      ) : (
                        <div className={`mb-1 text-xs font-medium ${isToday ? "text-brand" : "text-paper-muted"}`}>{Number(key.slice(8))}</div>
                      )}
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
                        {items.length > 3 && (
                          <Link
                            href={`${linkFor(mes, modo, gestion, key)}#citas-del-dia`}
                            className="block rounded px-1 text-[11px] font-medium text-brand hover:underline"
                          >
                            +{items.length - 3} más · ver todas
                          </Link>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {dia && (
        <section id="citas-del-dia" className="mt-5 scroll-mt-4 rounded-2xl border border-paper-border bg-paper-card shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-border px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-paper-ink">{diaLabel}</h2>
              <p className="text-xs text-paper-muted">
                {diaItems.length} cita{diaItems.length === 1 ? "" : "s"}, ordenadas por hora
              </p>
            </div>
            <Link href={linkFor(mes, modo, gestion)} className="rounded-lg border border-paper-border px-3 py-1.5 text-sm text-paper-inkLight hover:bg-paper">
              Cerrar
            </Link>
          </header>
          {diaItems.length === 0 ? (
            <p className="px-4 py-6 text-sm text-paper-muted">No hay citas este día con los filtros actuales.</p>
          ) : (
            <ul className="divide-y divide-paper-border">
              {diaItems.map((row) => {
                const gestionState = getGestionState(row.gestion_estado);
                return (
                  <li key={row.id}>
                    <Link href={`/leads/${row.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper">
                      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-paper-ink">{madridTime(new Date(row.cita_inicio))}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-paper-ink">{row.name || "Sin nombre"}</span>
                        {row.phone && <span className="block text-xs text-paper-muted">{row.phone}</span>}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${chipClass(row)}`}>{isVideo(row) ? "Meet" : "Presencial"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${gestionState.className}`} title={gestionState.description}>
                        {gestionState.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-paper-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-400" /> Presencial</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Meet / videoconferencia</span>
      </div>
    </div>
  );
}

