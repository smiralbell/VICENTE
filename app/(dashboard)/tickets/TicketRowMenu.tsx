"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type Props = {
  onView: () => void;
  onDelete: () => void;
};

export default function TicketRowMenu({ onView, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.right,
    });
  };

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    updateMenuPosition();
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Opciones de incidencia"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggleMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-paper-muted hover:bg-paper hover:text-paper-ink focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </button>

      {open && mounted && menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: menuStyle.top,
              left: menuStyle.left,
              transform: "translateX(-100%)",
            }}
            className="z-[60] min-w-[9.5rem] rounded-lg border border-paper-border bg-paper-card py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onView();
              }}
              className="flex w-full items-center px-3 py-2.5 text-left text-sm text-paper-ink hover:bg-paper"
            >
              Ver
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
