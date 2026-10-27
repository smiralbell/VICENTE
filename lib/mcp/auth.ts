import { createHash } from "crypto";
import { query } from "../db";

const TOKENS_TABLE = "eliasymunozabogados_mcp_tokens";

export type McpToken = { id: number; nombre: string };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Token del socio: cabecera Authorization: Bearer <token> o, para clientes que no permiten cabeceras, ?token=.
// Vale solo si existe, no ha caducado y no se ha revocado.
export async function checkMcpToken(request: Request): Promise<McpToken | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (token.length < 20) return null;

  const { rows } = await query<McpToken>(
    `UPDATE ${TOKENS_TABLE} SET last_used_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
     RETURNING id, nombre`,
    [hashToken(token)]
  );
  return rows[0] ?? null;
}
