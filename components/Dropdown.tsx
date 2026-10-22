"use client";

import { useEffect, useRef, useState } from "react";

// className: clases de color de fondo (y texto) que se muestran como etiqueta.
export type DropdownOption = { key: string; label: string; className?: string };

type Props = {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (key: string) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  align?: "left" | "right";
};

function Chip({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium ${className || "text-paper-ink"}`}>
      {label}
    </span>
  );
}

// Desplegable propio, con el mismo estilo en todo el dashboard. Los estados se ven como etiquetas de color.
export default function Dropdown({ label, value, options, onChange, disabled, className = "", compact = false, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-block max-w-full ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 rounded-xl border border-paper-border bg-paper-card text-left text-sm text-paper-ink shadow-sm transition-colors hover:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60 ${
          compact ? "h-8 w-full min-w-0 px-2 text-xs" : "h-11 min-w-[10rem] px-3.5"
        }`}
      >
        {current?.className ? <Chip label={current.label} className={current.className} /> : <span className="truncate">{current?.label}</span>}
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-3.5 w-3.5 shrink-0 text-paper-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className={`absolute z-50 mt-1.5 max-h-80 min-w-full overflow-auto rounded-2xl border border-paper-border bg-paper-card p-1.5 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((o) => {
            const selected = o.key === value;
            return (
              <li key={o.key} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onChange(o.key);
                  }}
                  className={`flex w-full items-center rounded-xl px-2 py-1.5 text-left text-sm transition-colors hover:bg-paper ${
                    selected ? "bg-brand-subtle" : ""
                  }`}
                >
                  {o.className ? <Chip label={o.label} className={o.className} /> : <span className="px-1 text-paper-inkLight">{o.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
