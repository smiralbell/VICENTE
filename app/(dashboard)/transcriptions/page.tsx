export default function TranscriptionsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-paper-border">
        <svg
          className="h-7 w-7 text-paper-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 8h14M5 12h14M5 16h10"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-paper-inkLight">
        Seleccione una transcripción
      </p>
      <p className="text-xs text-paper-muted max-w-sm text-center">
        Elija una transcripción en el listado de la izquierda para ver el
        contenido completo de la llamada.
      </p>
    </div>
  );
}

