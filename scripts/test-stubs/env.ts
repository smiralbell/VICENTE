// Stub de lib/env.ts para las pruebas: nunca lee claves reales.
export function requireEnv(name: string): string {
  return `valor-de-prueba-${name}`;
}
