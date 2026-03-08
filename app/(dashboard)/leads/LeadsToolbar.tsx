"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  defaultValue?: string;
  page: number;
  total: number;
  totalPages: number;
};

export default function LeadsToolbar({ defaultValue = "" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams.toString());
      params.set("q", value.trim());
      params.delete("page");
      router.push(`/leads?${params.toString()}`);
    },
    [value, router, searchParams]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full gap-2"
      role="search"
      aria-label="Buscar leads"
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por nombre, email o teléfono"
        aria-label="Texto de búsqueda"
        className="min-w-0 flex-1 rounded border border-paper-border bg-paper-card px-3 py-2 text-sm text-paper-ink placeholder-paper-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <button
        type="submit"
        className="shrink-0 rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
      >
        Buscar
      </button>
    </form>
  );
}
