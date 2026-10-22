// Icono de ayuda: al pasar el cursor explica cada columna y cada estado.
const ORIGEN = [
  { label: "Formulario", description: "La persona rellenó el formulario de la web." },
  { label: "Widget", description: "La persona escribió en el chat de la web." },
  { label: "Llamada", description: "La persona llamó al despacho, o se agendó o derivó durante una llamada." },
];

const ESTADO = [
  { label: "Derivado", description: "El caso lo tiene que llevar un abogado concreto." },
  { label: "Agendado", description: "Hay una consulta agendada, pendiente de confirmar." },
  { label: "Cita confirmada", description: "Un abogado ha confirmado la consulta." },
  { label: "No contesta", description: "Se llamó y nadie contestó, ni en el segundo intento." },
  { label: "Reintento pendiente", description: "No contestó la primera llamada. Se está haciendo el segundo intento." },
  { label: "Contestó", description: "La llamada automática tuvo respuesta." },
  { label: "Llamó al despacho", description: "La persona llamó y todavía no hay cita ni decisión." },
  { label: "Sin llamar", description: "Llegó por el formulario y todavía no se le ha llamado." },
  { label: "Pendiente de gestionar", description: "Nadie del despacho lo ha revisado todavía." },
  { label: "Cerrado", description: "Caso resuelto o descartado." },
];

const GESTION = [
  { label: "Pendiente de gestionar", description: "Nadie del despacho lo ha revisado todavía." },
  { label: "Cita pendiente de confirmar", description: "Hay una consulta agendada que falta por confirmar." },
  { label: "Cita confirmada", description: "Un abogado ha confirmado la consulta." },
  { label: "Derivado a abogado", description: "El caso lo tiene que llevar un abogado concreto." },
  { label: "Cerrado", description: "Caso resuelto o descartado." },
];

function Section({ title, items }: { title: string; items: { label: string; description: string }[] }) {
  return (
    <>
      <p className="mb-1 font-semibold text-paper-ink">{title}</p>
      <ul className="mb-3 space-y-1.5 text-paper-inkLight">
        {items.map((item) => (
          <li key={item.label}>
            <span className="font-medium text-paper-ink">{item.label}:</span> {item.description}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function EstadosLeyenda() {
  return (
    <div className="group relative inline-flex">
      <span
        tabIndex={0}
        aria-label="Explicación de las columnas"
        className="flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-paper-border bg-paper-card text-xs font-semibold text-paper-muted hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
      >
        i
      </span>
      <div
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-8 z-50 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-paper-border bg-paper-card p-4 text-left text-xs shadow-lg group-hover:visible group-focus-within:visible"
      >
        <Section title="Origen (de dónde llega)" items={ORIGEN} />
        <Section title="Estado (lo que ha pasado)" items={ESTADO} />
        <Section title="Gestión (la decide el equipo)" items={GESTION} />
      </div>
    </div>
  );
}
