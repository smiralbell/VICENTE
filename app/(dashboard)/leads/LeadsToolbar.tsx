"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import Dropdown from "@/components/Dropdown";
import DateRangeFilter from "@/components/DateRangeFilter";
import { writeRangeCookie } from "@/lib/dateRange";
import { ESTADO_FILTERS, GESTION_FILTERS, ORIGEN_FILTERS } from "@/lib/leadFilters";
import EstadosLeyenda from "./EstadosLeyenda";

type Props = {
  defaultValue?: string;
  origen?: string;
  estado?: string;
  gestion?: string;
  from?: string;
  to?: string;
  page: number;
  total: number;
  totalPages: number;
};

const CONTROL =
  "h-11 rounded-xl border border-paper-border bg-paper-card text-sm text-paper-ink shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export default function LeadsToolbar({ defaultValue = "", origen = "", estado = "", gestion = "", from = "", to = "" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  const update = useCallback(
    (changes: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(changes)) {
        if (val) params.set(key, val);
        else params.delete(key);
      }
      params.delete("page");
      router.push(`/leads?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      update({ q: value.trim() });
    },
    [value, update]
  );

  const hasFilters = Boolean(origen || estado || gestion || from || to);

  // Quita también las fechas compartidas con Conversaciones y Transcripciones.
  const clearAll = () => {
    writeRangeCookie({ from: "", to: "" });
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    router.push(`/leads${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className="flex w-full items-center gap-2">
      <form onSubmit={handleSubmit} role="search" aria-label="Buscar leads" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Dropdown label="Filtrar por origen" value={origen} options={ORIGEN_FILTERS} onChange={(v) => update({ origen: v })} className="shrink-0" />
        <Dropdown label="Filtrar por estado" value={estado} options={ESTADO_FILTERS} onChange={(v) => update({ estado: v })} className="shrink-0" />
        <Dropdown label="Filtrar por gestión" value={gestion} options={GESTION_FILTERS} onChange={(v) => update({ gestion: v })} className="shrink-0" />

        <DateRangeFilter label="Creado" range={{ from, to }} />

        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Nombre, email o teléfono"
          aria-label="Texto de búsqueda"
          className={`${CONTROL} min-w-[180px] flex-1 px-4 placeholder-paper-muted`}
        />

        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-brand px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
        >
          Buscar
        </button>
        {hasFilters && (
          <button type="button" onClick={clearAll} className="h-11 shrink-0 rounded-xl px-3 text-xs font-medium text-brand hover:bg-paper">
            Quitar filtros
          </button>
        )}
      </form>
      <EstadosLeyenda />
    </div>
  );
}
