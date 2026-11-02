"use client";

import { useEffect } from "react";

// Registra el service worker de la app instalable. Si el navegador no lo soporta, no pasa nada.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
