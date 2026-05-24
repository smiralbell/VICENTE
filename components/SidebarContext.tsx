"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";
const OFFWORK_ONLY_KEY = "dashboard-offwork-only";
const SYSTEM_PUBLISHED_KEY = "dashboard-system-published";
const MOBILE_BREAKPOINT = 768;

type Context = {
  collapsed: boolean;
  toggle: () => void;
  width: number;
  offWorkOnly: boolean;
  setOffWorkOnly: (value: boolean) => void;
  systemPublished: boolean;
  setSystemPublished: (value: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  isMobile: boolean;
};

const SidebarContext = createContext<Context | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [offWorkOnly, setOffWorkOnlyState] = useState(false);
  const [systemPublished, setSystemPublishedState] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
      setOffWorkOnlyState(localStorage.getItem(OFFWORK_ONLY_KEY) === "true");
      const storedPublished = localStorage.getItem(SYSTEM_PUBLISHED_KEY);
      if (storedPublished !== null) {
        setSystemPublishedState(storedPublished === "true");
      }
    } catch {}
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const setOffWorkOnly = useCallback((value: boolean) => {
    setOffWorkOnlyState(value);
    try {
      localStorage.setItem(OFFWORK_ONLY_KEY, String(value));
    } catch {}
  }, []);

  const setSystemPublished = useCallback((value: boolean) => {
    setSystemPublishedState(value);
    try {
      localStorage.setItem(SYSTEM_PUBLISHED_KEY, String(value));
    } catch {}
  }, []);

  const width = isMobile ? 0 : collapsed ? 72 : 280;

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle,
        width,
        offWorkOnly,
        setOffWorkOnly,
        systemPublished,
        setSystemPublished,
        mobileOpen,
        setMobileOpen,
        isMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
