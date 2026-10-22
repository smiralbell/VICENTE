"use client";

import { useEffect } from "react";

// Si una pantalla del dashboard falla, avisa al CRM y deja reintentar.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "dashboard", message: error.message, stack: error.stack, digest: error.digest }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <h2 className="text-lg font-semibold text-paper-ink">Algo no ha funcionado</h2>
      <p className="text-sm text-paper-muted">El equipo técnico ya ha recibido el aviso.</p>
      <button type="button" onClick={reset} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
        Reintentar
      </button>
    </div>
  );
}
