"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Escribe una nota del equipo sobre el lead y recarga el panel.
export default function NotasForm({ leadId }: { leadId: number }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch(`/api/leads/${leadId}/notas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar la nota");
      return;
    }
    setTexto("");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={guardar} className="space-y-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Escribe una nota sobre este lead…"
        className="w-full rounded-xl border border-paper-border bg-paper-card px-3 py-2 text-sm text-paper-ink placeholder:text-paper-muted focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={isPending || !texto.trim()}
        className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Guardar nota
      </button>
    </form>
  );
}
