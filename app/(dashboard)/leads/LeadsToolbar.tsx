"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { LEAD_STATUS_FILTERS, MODALIDAD_FILTERS } from "@/lib/leadFilters";

type Props = {
  defaultValue?: string;
  status?: string;
  modalidad?: string;
  from?: string;
  to?: string;
  page: number;
  total: number;
  totalPages: number;
};

const CONTROL =
  "h-11 rounded-xl border border-paper-border bg-paper-card text-sm text-paper-ink shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

type Option = { key: string; label: string };

function SelectBox({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} appearance-none py-0 pl-4 pr-10`}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted"
      >
        <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function LeadsToolbar({
  defaultValue = "",
  status = "",
  modalidad = "",
  from = "",
  to = "",
}: Props) {
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

  const hasDates = Boolean(from || to);

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Buscar leads"
      className="flex w-full flex-wrap items-center gap-2"
    >
      <SelectBox
        label="Filtrar por estado"
        value={status}
        options={LEAD_STATUS_FILTERS}
        onChange={(v) => update({ estado: v })}
      />

      <SelectBox
        label="Filtrar por modalidad"
        value={modalidad}
        options={MODALIDAD_FILTERS}
        onChange={(v) => update({ modalidad: v })}
      />

      <div className={`${CONTROL} flex items-center gap-1 px-2`}>
        <input
          type="date"
          aria-label="Desde"
          value={from}
          max={to || undefined}
          onChange={(e) => update({ desde: e.target.value })}
          className="h-full w-[120px] bg-transparent px-1 text-sm focus:outline-none"
        />
        <span aria-hidden="true" className="text-paper-muted">–</span>
        <input
          type="date"
          aria-label="Hasta"
          value={to}
          min={from || undefined}
          onChange={(e) => update({ hasta: e.target.value })}
          className="h-full w-[120px] bg-transparent px-1 text-sm focus:outline-none"
        />
        {hasDates && (
          <button
            type="button"
            onClick={() => update({ desde: "", hasta: "" })}
            aria-label="Quitar filtro de fechas"
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-paper-muted hover:bg-paper hover:text-paper-ink"
          >
            ×
          </button>
        )}
      </div>

      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por nombre, email o teléfono"
        aria-label="Texto de búsqueda"
        className={`${CONTROL} min-w-[200px] flex-1 px-4 placeholder-paper-muted`}
      />

      <button
        type="submit"
        className="h-11 shrink-0 rounded-xl bg-brand px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
      >
        Buscar
      </button>
    </form>
  );
}
