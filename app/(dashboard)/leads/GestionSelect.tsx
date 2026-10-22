"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Dropdown from "@/components/Dropdown";
import { GESTION_STATES, getGestionState } from "@/lib/leadFilters";

type Props = {
  leadId: number;
  value: string | null;
};

// Cambia el estado de gestión de un lead desde la tabla o la ficha.
export default function GestionSelect({ leadId, value, compact = false }: Props & { compact?: boolean }) {
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
    <div title={state.description} className="min-w-0 max-w-full">
      <Dropdown
        label="Estado de gestión"
        value={current}
        disabled={isPending}
        onChange={change}
        compact={compact}
        options={GESTION_STATES.map((g) => ({ key: g.key, label: g.label, className: g.className }))}
      />
    </div>
  );
}
