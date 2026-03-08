"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }
      router.push("/leads");
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="rounded border border-paper-border bg-paper-card p-8">
          <p className="font-serif text-sm text-paper-muted">
            G. Elías y Muñoz Abogados
          </p>
          <h1 className="mt-1 font-serif text-xl font-medium text-paper-ink">
            Acceso al panel
          </h1>
          <p className="mt-3 text-sm text-paper-muted">
            Introduzca la contraseña de acceso
          </p>
          <form onSubmit={handleSubmit} className="mt-6">
            <label htmlFor="password" className="sr-only">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded border border-paper-border bg-paper-card px-3 py-2.5 text-paper-ink placeholder-paper-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              autoComplete="current-password"
              required
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded bg-brand py-2.5 font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 disabled:opacity-50"
            >
              {loading ? "Comprobando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
