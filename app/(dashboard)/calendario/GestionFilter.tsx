"use client";

import { useRouter } from "next/navigation";
import Dropdown from "@/components/Dropdown";
import { GESTION_FILTERS } from "@/lib/leadFilters";

type Props = { mes: string; modo: string; current: string };

// Filtro de gestión del calendario: al elegir, cambia la URL con el nuevo valor.
export default function GestionFilter({ mes, modo, current }: Props) {
  const router = useRouter();
  return (
    <div className="min-w-[13rem]">
      <Dropdown
        label="Filtrar citas por gestión"
        value={current}
        options={GESTION_FILTERS.map((g) => ({ key: g.key, label: g.label, className: g.className }))}
        onChange={(key) => {
          const q = new URLSearchParams({ mes, modo });
          if (key) q.set("gestion", key);
          router.push(`/calendario?${q.toString()}`);
        }}
      />
    </div>
  );
}
