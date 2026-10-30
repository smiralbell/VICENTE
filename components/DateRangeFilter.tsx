"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { readRangeCookie, resolveRange, writeRangeCookie, type DateRange } from "@/lib/dateRange";

const CONTROL =
  "h-11 rounded-xl border border-paper-border bg-paper-card text-sm text-paper-ink shadow-sm transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30";

// Rango de fechas de la URL o, si no hay, el que se eligió en otra página (cookie).
export function useSharedRange(): DateRange {
  const searchParams = useSearchParams();
  const [cookie, setCookie] = useState<DateRange>({ from: "", to: "" });
  useEffect(() => setCookie(readRangeCookie()), [searchParams]);
  const fromUrl = resolveRange({ desde: searchParams.get("desde"), hasta: searchParams.get("hasta") }, null);
  const hasUrl = searchParams.has("desde") || searchParams.has("hasta");
  return hasUrl ? fromUrl : cookie;
}

// Selector «Desde – Hasta» compartido: al cambiarlo se guarda para las demás páginas y se aplica aquí.
export default function DateRangeFilter({ label = "Fecha", range }: { label?: string; range: DateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (next: DateRange) => {
    writeRangeCookie(next);
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of [["desde", next.from], ["hasta", next.to]] as const) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className={`${CONTROL} flex shrink-0 items-center gap-1 px-2`}>
      <span className="px-1 text-xs text-paper-muted">{label}</span>
      <input
        type="date"
        aria-label="Desde"
        value={range.from}
        max={range.to || undefined}
        onChange={(e) => apply({ ...range, from: e.target.value })}
        className="h-full w-[118px] bg-transparent px-1 text-sm focus:outline-none"
      />
      <span aria-hidden="true" className="text-paper-muted">–</span>
      <input
        type="date"
        aria-label="Hasta"
        value={range.to}
        min={range.from || undefined}
        onChange={(e) => apply({ ...range, to: e.target.value })}
        className="h-full w-[118px] bg-transparent px-1 text-sm focus:outline-none"
      />
      {(range.from || range.to) && (
        <button
          type="button"
          onClick={() => apply({ from: "", to: "" })}
          aria-label="Quitar fechas"
          title="Quitar fechas"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-paper-muted hover:bg-paper hover:text-brand"
        >
          ×
        </button>
      )}
    </div>
  );
}
