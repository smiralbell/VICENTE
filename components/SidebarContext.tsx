"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";
const MOBILE_BREAKPOINT = 768;
const SETTINGS_POLL_MS = 5000;

type DashboardSettingsResponse = {
  offWorkOnly: boolean;
  systemPublished: boolean;
  updatedAt?: string | null;
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

function settingsFingerprint(settings: DashboardSettingsResponse): string {
  return `${settings.updatedAt ?? ""}|${settings.offWorkOnly}|${settings.systemPublished}`;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [offWorkOnly, setOffWorkOnly] = useState(false);
  const [systemPublished, setSystemPublished] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const lastFingerprintRef = useRef<string | null>(null);
  const togglingRef = useRef(0);

  const applySettings = useCallback((settings: DashboardSettingsResponse) => {
    const fingerprint = settingsFingerprint(settings);
    if (lastFingerprintRef.current === fingerprint) {
      setSettingsLoaded(true);
      return;
    }
    lastFingerprintRef.current = fingerprint;
    setOffWorkOnly(settings.offWorkOnly);
    setSystemPublished(settings.systemPublished);
    setSettingsLoaded(true);
  }, []);

  const loadSettings = useCallback(async () => {
    if (togglingRef.current > 0) return;
    const settings = await fetchSettings();
    if (settings) applySettings(settings);
    else setSettingsLoaded(true);
  }, [applySettings]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {}
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const refresh = () => {
      void loadSettings();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const intervalId = window.setInterval(refresh, SETTINGS_POLL_MS);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
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
    togglingRef.current += 1;
    setOffWorkOnly(next);

    try {
      const res = await fetch("/api/webhook-offwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offWorkOnly: next }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      applySettings({
        offWorkOnly: Boolean(data.offWorkOnly),
        systemPublished: Boolean(data.systemPublished),
        updatedAt: data.updatedAt ?? new Date().toISOString(),
      });
    } catch {
      setOffWorkOnly(previous);
    } finally {
      togglingRef.current -= 1;
    }
  }, [offWorkOnly, applySettings]);

  const toggleSystemPublished = useCallback(async () => {
    const previous = systemPublished;
    const next = !previous;
    togglingRef.current += 1;
    setSystemPublished(next);

    try {
      const res = await fetch("/api/webhook-system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPublished: next }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      applySettings({
        offWorkOnly: Boolean(data.offWorkOnly),
        systemPublished: Boolean(data.systemPublished),
        updatedAt: data.updatedAt ?? new Date().toISOString(),
      });
    } catch {
      setSystemPublished(previous);
    } finally {
      togglingRef.current -= 1;
    }
  }, [systemPublished, applySettings]);

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
