// Cron de reintentos: se ejecuta dentro del propio servidor cada 10 minutos.
// Solo en producción y en el entorno de Node, para no lanzar llamadas en desarrollo.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const { runRetryCalls } = await import("./lib/callFlows");
  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runRetryCalls();
    } catch {
      // Un fallo se reintenta en la siguiente vuelta.
    } finally {
      running = false;
    }
  }, 10 * 60 * 1000);
}
