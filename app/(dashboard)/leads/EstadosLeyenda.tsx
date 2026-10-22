import { CALL_STATES, GESTION_STATES } from "@/lib/leadFilters";

// Icono de ayuda: al pasar el cursor explica cada estado.
export default function EstadosLeyenda() {
  return (
    <div className="group relative inline-flex">
      <span
        tabIndex={0}
        aria-label="Explicación de los estados"
        className="flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-paper-border bg-paper-card text-xs font-semibold text-paper-muted hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
      >
        i
      </span>
      <div
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-8 z-50 w-80 rounded-xl border border-paper-border bg-paper-card p-4 text-left text-xs shadow-lg group-hover:visible group-focus-within:visible"
      >
        <p className="mb-1 font-semibold text-paper-ink">Llamada (automática)</p>
        <ul className="mb-3 space-y-1.5 text-paper-inkLight">
          {Object.values(CALL_STATES).map((s) => (
            <li key={s.label}>
              <span className="font-medium text-paper-ink">{s.label}:</span> {s.description}
            </li>
          ))}
        </ul>
        <p className="mb-1 font-semibold text-paper-ink">Gestión (la decide el equipo)</p>
        <ul className="space-y-1.5 text-paper-inkLight">
          {GESTION_STATES.map((g) => (
            <li key={g.key}>
              <span className="font-medium text-paper-ink">{g.label}:</span> {g.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
