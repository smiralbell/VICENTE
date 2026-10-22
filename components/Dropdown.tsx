"use client";

import { useEffect, useRef, useState } from "react";

export type DropdownOption = { key: string; label: string; dot?: string };

type Props = {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (key: string) => void;
  disabled?: boolean;
  className?: string;
  align?: "left" | "right";
};

// Desplegable propio, con el mismo estilo en todo el dashboard.
export default function Dropdown({ label, value, options, onChange, disabled, className = "", align = "left" }: Props) {
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
    <div ref={ref} className={`relative inline-block ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 min-w-[11rem] items-center justify-between gap-3 rounded-xl border border-paper-border bg-paper-card px-3.5 text-left text-sm text-paper-ink shadow-sm transition-colors hover:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.dot && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${current.dot}`} />}
          <span className="truncate">{current?.label}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-paper-muted transition-transform ${open ? "rotate-180" : ""}`}>
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
                  className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-paper ${
                    selected ? "bg-brand-subtle font-medium text-paper-ink" : "text-paper-inkLight"
                  }`}
                >
                  {o.dot && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${o.dot}`} />}
                  <span>{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
