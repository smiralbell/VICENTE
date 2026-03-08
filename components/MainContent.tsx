"use client";

import { useSidebar } from "./SidebarContext";

export default function MainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { width } = useSidebar();
  return (
    <div
      className="min-h-screen flex-1 transition-[margin] duration-300 ease-in-out"
      style={{ marginLeft: width }}
    >
      <main className="flex min-h-screen flex-col py-8 px-8 md:px-10 lg:px-14">
        {children}
      </main>
    </div>
  );
}
