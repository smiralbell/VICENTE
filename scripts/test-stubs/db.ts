// Stub de lib/db.ts para las pruebas: no conecta a ninguna base de datos, solo guarda las consultas.
export type QueryCall = { text: string; params: (string | number | boolean | null)[] | undefined };

export const queryCalls: QueryCall[] = [];

export function resetQueries(): void {
  queryCalls.length = 0;
}

export async function query<T = unknown>(
  text: string,
  params?: (string | number | boolean | null)[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  queryCalls.push({ text, params });
  return { rows: [], rowCount: 1 };
}
