import { getUsageByHour, type HourUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HOURS = 72;

const numberFormat = new Intl.NumberFormat("es-ES");

function formatCost(value: number | null): string {
  return value === null ? "Sin precio" : `${value.toFixed(4)} USD`;
}

function totalCost(rows: HourUsage[]): number | null {
  let total = 0;
  for (const row of rows) {
    if (row.costUsd === null) return null;
    total += row.costUsd;
  }
  return total;
}

// Consumo de la API de OpenAI por hora. Los tokens son los que devuelve la API; el coste usa la tabla de precios del código.
export default async function ConsumoPage() {
  const rows = await getUsageByHour(HOURS);
  const total = totalCost(rows);
  const totalCalls = rows.reduce((sum, row) => sum + row.calls, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-paper-ink">Consumo de la IA</h1>
        <p className="mt-1 text-sm text-paper-muted">Tokens y coste por hora, de las últimas {HOURS} horas (hora de Madrid).</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-paper-border bg-paper-card p-4 shadow-sm">
          <p className="text-xs text-paper-muted">Coste total</p>
          <p className="mt-1 text-lg font-semibold text-paper-ink">{total === null ? "Sin precio" : `${total.toFixed(4)} USD`}</p>
        </div>
        <div className="rounded-xl border border-paper-border bg-paper-card p-4 shadow-sm">
          <p className="text-xs text-paper-muted">Llamadas a la IA</p>
          <p className="mt-1 text-lg font-semibold text-paper-ink">{numberFormat.format(totalCalls)}</p>
        </div>
        <div className="rounded-xl border border-paper-border bg-paper-card p-4 shadow-sm">
          <p className="text-xs text-paper-muted">Horas con consumo</p>
          <p className="mt-1 text-lg font-semibold text-paper-ink">{rows.length}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-paper-muted">Todavía no hay consumo registrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-paper-border bg-paper-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-paper-border text-xs text-paper-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Hora</th>
                <th className="px-3 py-2.5 font-medium">Llamadas</th>
                <th className="px-3 py-2.5 font-medium">Tokens entrada</th>
                <th className="px-3 py-2.5 font-medium">Tokens salida</th>
                <th className="px-3 py-2.5 font-medium">Coste</th>
                <th className="px-3 py-2.5 font-medium">Modelos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.hour} className="border-b border-paper-border last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 text-paper-ink">{row.hour}</td>
                  <td className="px-3 py-2.5 text-paper-inkLight">{numberFormat.format(row.calls)}</td>
                  <td className="px-3 py-2.5 text-paper-inkLight">{numberFormat.format(row.inputTokens)}</td>
                  <td className="px-3 py-2.5 text-paper-inkLight">{numberFormat.format(row.outputTokens)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-paper-ink">{formatCost(row.costUsd)}</td>
                  <td className="px-3 py-2.5 text-xs text-paper-muted">
                    {row.models.map((m) => `${m.model}: ${numberFormat.format(m.calls)} llamadas`).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
