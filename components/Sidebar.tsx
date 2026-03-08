"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./SidebarContext";

const NAV = [
  { href: "/leads", label: "Leads" },
  { href: "/conversations", label: "Conversaciones" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, width, offWorkOnly, setOffWorkOnly } = useSidebar();

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-20 flex h-full flex-col bg-brand transition-all duration-300 ease-in-out"
        style={{ width }}
      >
        <div className={`flex h-14 shrink-0 items-center border-b border-white/10 px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/15 font-serif text-sm font-semibold text-white">
                E&M
              </div>
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-semibold text-white">
                  G. Elías y Muñoz
                </p>
                <p className="truncate text-[10px] text-white/70">
                  Abogados
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Mostrar menú" : "Ocultar menú"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            {collapsed ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  collapsed ? "justify-center px-0" : "px-4"
                } ${
                  active
                    ? "bg-white/15 font-medium text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {href === "/leads" ? (
                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                )}
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className={`flex flex-col items-center gap-3 ${collapsed ? "px-0" : ""}`}>
            {!collapsed && (
              <p className="text-center text-[11px] font-medium uppercase tracking-wider text-white/70">
                {offWorkOnly ? "Solo fuera laboral" : "Siempre activo"}
              </p>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={offWorkOnly}
              aria-label={offWorkOnly ? "Solo horario fuera laboral (ON)" : "Funcionar siempre (OFF)"}
              onClick={() => {
                const newValue = !offWorkOnly;
                setOffWorkOnly(newValue);
                const label = newValue ? "on" : "off";
                fetch("/api/webhook-offwork", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ state: label, label }),
                }).catch(() => {});
              }}
              className={`relative flex h-9 w-24 shrink-0 items-center rounded-full px-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 ${
                offWorkOnly ? "bg-emerald-500/90" : "bg-white/25"
              }`}
              style={{ justifyContent: offWorkOnly ? "flex-end" : "flex-start" }}
            >
              <span
                className={`h-6 w-6 rounded-full shadow-md transition-colors ${
                  offWorkOnly ? "bg-white" : "bg-white/90"
                }`}
              />
              {!collapsed && (
                <>
                  <span
                    className={`absolute left-2 text-[10px] font-bold uppercase tracking-wider ${
                      !offWorkOnly ? "text-white" : "text-white/50"
                    }`}
                  >
                    Off
                  </span>
                  <span
                    className={`absolute right-2 text-[10px] font-bold uppercase tracking-wider ${
                      offWorkOnly ? "text-white" : "text-white/50"
                    }`}
                  >
                    On
                  </span>
                </>
              )}
            </button>
            {!collapsed && (
              <p className="text-center text-[11px] leading-snug text-white/80">
                Si está <strong>ON</strong>, el sistema funcionará solo en horario fuera laboral. Si está <strong>OFF</strong>, funcionará siempre.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 p-2">
          <form action="/api/logout" method="POST">
            <button
              type="submit"
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 ${
                collapsed ? "justify-center px-0" : "px-3"
              }`}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!collapsed && <span>Cerrar sesión</span>}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
