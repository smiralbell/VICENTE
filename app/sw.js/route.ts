// Service worker mínimo para que Chrome ofrezca «Instalar app». No guarda nada en caché: el Dashboard
// siempre muestra datos al día y, sin conexión, el navegador enseña su aviso normal.
const SCRIPT = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
