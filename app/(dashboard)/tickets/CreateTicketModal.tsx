"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { inputClass, labelClass, type Priority } from "./ticketUtils";

type TicketFormState = {
  title: string;
  description: string;
  priority: Priority;
  module: string;
};

const INITIAL_STATE: TicketFormState = {
  title: "",
  description: "",
  priority: "medium",
  module: "",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateTicketModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<TicketFormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_STATE);
      setErrorMessage(null);
    }
  }, [open]);

  if (!open || !mounted) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim() || undefined,
          description: form.description.trim() || undefined,
          priority: form.priority,
          fields: {
            modulo: form.module.trim() || undefined,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "No se ha podido enviar el ticket.");
      }

      onCreated();
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Ha ocurrido un error al enviar la incidencia. Inténtelo de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nueva incidencia"
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-paper-border bg-paper-card shadow-2xl sm:rounded-2xl"
      >
        <div className="flex justify-end border-b border-paper-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="flex h-9 w-9 items-center justify-center rounded-md text-paper-muted hover:bg-paper hover:text-paper-ink"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <label htmlFor="ticket-title" className={labelClass}>
              Título
            </label>
            <input
              id="ticket-title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Ej. Error al exportar un informe"
              className={inputClass}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ticket-description" className={labelClass}>
              Descripción
            </label>
            <textarea
              id="ticket-description"
              name="description"
              rows={4}
              value={form.description}
              onChange={handleChange}
              placeholder="Qué ocurrió, qué esperaba y en qué pantalla."
              className={`${inputClass} resize-y`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="ticket-priority" className={labelClass}>
                Prioridad
              </label>
              <select
                id="ticket-priority"
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ticket-module" className={labelClass}>
                Módulo
              </label>
              <input
                id="ticket-module"
                name="module"
                value={form.module}
                onChange={handleChange}
                placeholder="Leads, Conversaciones…"
                className={inputClass}
              />
            </div>
          </div>

          {errorMessage && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-paper-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-paper-border px-4 py-2.5 text-sm text-paper-inkLight hover:bg-paper"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Enviar incidencia"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
