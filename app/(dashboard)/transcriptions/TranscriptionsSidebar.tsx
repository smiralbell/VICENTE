"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type TranscriptionItem = {
  id: number;
  transcription: string | null;
  phone: string | null;
  name: string | null;
  mail: string | null;
  fecha: string | null;
};

export default function TranscriptionsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [items, setItems] = useState<TranscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/transcriptions?${params.toString()}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-paper-border md:w-[320px]">
      <div className="flex min-h-0 flex-1 flex-col pt-4 px-4 sm:pt-6 sm:px-5 md:pt-10 md:px-6">
        <div className="shrink-0">
          <form
            method="get"
            action="/transcriptions"
            className="flex flex-col gap-2 sm:flex-row"
            role="search"
            aria-label="Buscar transcripciones"
          >
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre, teléfono o email..."
              aria-label="Texto de búsqueda"
              className="min-w-0 flex-1 rounded-md border border-paper-border bg-white px-3 py-3 text-base text-paper-ink placeholder-paper-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:py-2 sm:text-sm"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-brand px-4 py-3 text-base font-medium text-white hover:bg-brand-hover sm:py-2 sm:text-sm"
            >
              Buscar
            </button>
          </form>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pt-4 md:pt-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-paper-muted">Cargando…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-paper-muted">
              No hay transcripciones
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map((t) => {
                const href = `/transcriptions/${t.id}`;
                const isActive = pathname === href;
                const title = t.name || t.phone || t.mail || `Transcripción #${t.id}`;
                const subtitle = t.phone || t.mail || "";
                const preview =
                  t.transcription && t.transcription.length > 80
                    ? t.transcription.slice(0, 80) + "…"
                    : t.transcription;

                return (
                  <li key={t.id}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-[56px] items-start gap-3 rounded-lg px-3 py-3 transition-colors ${
                        isActive
                          ? "bg-brand-subtle"
                          : "hover:bg-paper active:bg-paper-border"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                          isActive
                            ? "bg-brand text-white"
                            : "bg-paper-border text-paper-inkLight"
                        }`}
                      >
                        {(t.name || t.phone || "?")
                          .toString()
                          .trim()
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-medium ${
                            isActive ? "text-brand" : "text-paper-ink"
                          }`}
                        >
                          {title}
                        </p>
                        {subtitle && (
                          <p className="mt-0.5 truncate text-xs text-paper-muted">
                            {subtitle}
                          </p>
                        )}
                        {preview && (
                          <p className="mt-1 line-clamp-2 text-xs leading-snug text-paper-muted">
                            {preview}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

