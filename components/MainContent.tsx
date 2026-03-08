"use client";

import { useSidebar } from "./SidebarContext";

export default function MainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { width, isMobile, setMobileOpen } = useSidebar();
  return (
    <div
      className="min-h-screen flex-1 transition-[margin] duration-300 ease-in-out"
      style={{ marginLeft: width }}
    >
      {isMobile && (
        <div className="sticky top-0 z-[5] flex h-14 shrink-0 items-center border-b border-paper-border bg-paper px-4 safe-area-inset-left">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="flex h-10 w-10 items-center justify-center rounded-md text-paper-ink hover:bg-paper-border focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 font-serif text-sm font-semibold text-paper-ink">E&M Dashboard</span>
        </div>
      )}
      <main className="flex min-h-screen flex-col py-6 px-4 sm:py-8 sm:px-6 md:px-10 lg:px-14">
        {children}
      </main>
    </div>
  );
}
