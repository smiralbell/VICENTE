"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import Dropdown from "@/components/Dropdown";
import { GESTION_FILTERS, LEAD_STATUS_FILTERS, MODALIDAD_FILTERS } from "@/lib/leadFilters";
import EstadosLeyenda from "./EstadosLeyenda";

type Props = {
  defaultValue?: string;
  status?: string;
  gestion?: string;
  modalidad?: string;
  from?: string;
  to?: string;
  page: number;
  total: number;
  totalPages: number;
};

const CONTROL =
  "h-11 rounded-xl border border-paper-border bg-paper-card text-sm text-paper-ink shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export default function LeadsToolbar({ defaultValue = "", status = "", gestion = "", modalidad = "", from = "", to = "" }: Props) {
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

  const hasFilters = Boolean(status || gestion || modalidad || from || to);

  const clearAll = () => {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    router.push(`/leads${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className="flex w-full items-center gap-2">
      <form onSubmit={handleSubmit} role="search" aria-label="Buscar leads" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
        <Dropdown label="Filtrar por llamada" value={status} options={LEAD_STATUS_FILTERS} onChange={(v) => update({ estado: v })} className="shrink-0" />
        <Dropdown label="Filtrar por gestión" value={gestion} options={GESTION_FILTERS} onChange={(v) => update({ gestion: v })} className="shrink-0" />
        <Dropdown label="Filtrar por modalidad" value={modalidad} options={MODALIDAD_FILTERS} onChange={(v) => update({ modalidad: v })} className="shrink-0" />

        <div className={`${CONTROL} flex shrink-0 items-center gap-1 px-2`}>
          <span className="px-1 text-xs text-paper-muted">Creado</span>
          <input type="date" aria-label="Desde" value={from} max={to || undefined} onChange={(e) => update({ desde: e.target.value })} className="h-full w-[118px] bg-transparent px-1 text-sm focus:outline-none" />
          <span aria-hidden="true" className="text-paper-muted">–</span>
          <input type="date" aria-label="Hasta" value={to} min={from || undefined} onChange={(e) => update({ hasta: e.target.value })} className="h-full w-[118px] bg-transparent px-1 text-sm focus:outline-none" />
        </div>

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
