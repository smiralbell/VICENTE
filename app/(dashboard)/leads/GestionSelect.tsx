"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GESTION_STATES, getGestionState } from "@/lib/leadFilters";

type Props = {
  leadId: number;
  value: string | null;
};

// Cambia el estado de gestión de un lead desde la tabla o la ficha.
export default function GestionSelect({ leadId, value }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState(value ?? "pendiente");
  const state = getGestionState(current);

  async function change(next: string) {
    const previous = current;
    setCurrent(next);
    const res = await fetch(`/api/leads/${leadId}/gestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gestion: next }),
    });
    if (!res.ok) {
      setCurrent(previous);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-block">
      <select
        aria-label="Estado de gestión"
        title={state.description}
        value={current}
        disabled={isPending}
        onChange={(e) => change(e.target.value)}
        className={`cursor-pointer appearance-none rounded-full py-1 pl-3 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60 ${state.className}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5 7.5l5 5 5-5' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.5rem center",
          backgroundSize: "0.9rem",
        }}
      >
        {GESTION_STATES.map((g) => (
          <option key={g.key} value={g.key} title={g.description}>
            {g.label}
          </option>
        ))}
      </select>
    </div>
  );
}
