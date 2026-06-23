"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";
const MOBILE_BREAKPOINT = 768;

type DashboardSettingsResponse = {
  offWorkOnly: boolean;
  systemPublished: boolean;
};

type Context = {
  collapsed: boolean;
  toggle: () => void;
  width: number;
  offWorkOnly: boolean;
  systemPublished: boolean;
  settingsLoaded: boolean;
  toggleOffWorkOnly: () => Promise<void>;
  toggleSystemPublished: () => Promise<void>;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  isMobile: boolean;
};

const SidebarContext = createContext<Context | null>(null);

async function fetchSettings(): Promise<DashboardSettingsResponse | null> {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [offWorkOnly, setOffWorkOnly] = useState(false);
  const [systemPublished, setSystemPublished] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const applySettings = useCallback((settings: DashboardSettingsResponse) => {
    setOffWorkOnly(settings.offWorkOnly);
    setSystemPublished(settings.systemPublished);
    setSettingsLoaded(true);
  }, []);

  const loadSettings = useCallback(async () => {
    const settings = await fetchSettings();
    if (settings) applySettings(settings);
    else setSettingsLoaded(true);
  }, [applySettings]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {}
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const onFocus = () => {
      loadSettings();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadSettings]);

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

  const toggleOffWorkOnly = useCallback(async () => {
    const previous = offWorkOnly;
    const next = !previous;
    setOffWorkOnly(next);

    try {
      const res = await fetch("/api/webhook-offwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offWorkOnly: next }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setOffWorkOnly(Boolean(data.offWorkOnly));
      setSystemPublished(Boolean(data.systemPublished));
    } catch {
      setOffWorkOnly(previous);
    }
  }, [offWorkOnly]);

  const toggleSystemPublished = useCallback(async () => {
    const previous = systemPublished;
    const next = !previous;
    setSystemPublished(next);

    try {
      const res = await fetch("/api/webhook-system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPublished: next }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setOffWorkOnly(Boolean(data.offWorkOnly));
      setSystemPublished(Boolean(data.systemPublished));
    } catch {
      setSystemPublished(previous);
    }
  }, [systemPublished]);

  const width = isMobile ? 0 : collapsed ? 72 : 280;

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle,
        width,
        offWorkOnly,
        systemPublished,
        settingsLoaded,
        toggleOffWorkOnly,
        toggleSystemPublished,
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
