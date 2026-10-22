"use client";

import { useEffect } from "react";

// Último recurso: si falla la aplicación entera, avisa al CRM.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "aplicación", message: error.message, stack: error.stack, digest: error.digest }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <h2>Algo no ha funcionado</h2>
        <p>El equipo técnico ya ha recibido el aviso.</p>
        <button type="button" onClick={reset}>Reintentar</button>
      </body>
    </html>
  );
}
