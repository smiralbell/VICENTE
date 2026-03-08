export default function ConversationsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-paper-border">
        <svg className="h-7 w-7 text-paper-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-paper-inkLight">
        Seleccione una conversación
      </p>
      <p className="text-xs text-paper-muted">
        Elija una conversación en el listado para ver los mensajes
      </p>
    </div>
  );
}
