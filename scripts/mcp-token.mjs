// Tokens del MCP de socios (app/api/mcp). Solo se guarda el hash: el token se muestra una única vez al crearlo.
//
//   node scripts/mcp-token.mjs crear "Nombre del socio" [días]   (por defecto 90 días)
//   node scripts/mcp-token.mjs listar
//   node scripts/mcp-token.mjs revocar <id>
//
// Usa DATABASE_URL del entorno o, si no está, la del archivo .env.
import { createHash, randomBytes } from "crypto";
import { readFileSync } from "fs";
import pg from "pg";

const TABLE = "eliasymunozabogados_mcp_tokens";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const match = readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^DATABASE_URL=(.*)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  throw new Error("Falta DATABASE_URL");
}

const [command, ...rest] = process.argv.slice(2);
const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();

try {
  if (command === "crear") {
    const nombre = rest[0]?.trim();
    const dias = Number(rest[1] ?? 90);
    if (!nombre || !Number.isFinite(dias) || dias < 1) throw new Error('Uso: crear "Nombre del socio" [días]');
    const token = `mcp_${randomBytes(32).toString("base64url")}`;
    const hash = createHash("sha256").update(token).digest("hex");
    const { rows } = await client.query(
      `INSERT INTO ${TABLE} (nombre, token_hash, expires_at) VALUES ($1, $2, NOW() + make_interval(days => $3)) RETURNING id, expires_at`,
      [nombre, hash, Math.trunc(dias)]
    );
    console.log(`Token creado para ${nombre} (id ${rows[0].id}), caduca el ${rows[0].expires_at.toISOString().slice(0, 10)}.`);
    console.log("Guárdalo ahora: no se puede volver a ver.\n");
    console.log(token);
  } else if (command === "listar") {
    const { rows } = await client.query(`SELECT id, nombre, created_at, expires_at, revoked_at, last_used_at FROM ${TABLE} ORDER BY id`);
    for (const r of rows) {
      const estado = r.revoked_at ? "revocado" : r.expires_at < new Date() ? "caducado" : "activo";
      const usado = r.last_used_at ? r.last_used_at.toISOString().slice(0, 16).replace("T", " ") : "nunca";
      console.log(`${r.id}\t${estado}\t${r.nombre}\tcaduca ${r.expires_at.toISOString().slice(0, 10)}\túltimo uso ${usado}`);
    }
    if (!rows.length) console.log("No hay tokens.");
  } else if (command === "revocar") {
    const id = Number(rest[0]);
    if (!Number.isInteger(id)) throw new Error("Uso: revocar <id>");
    const { rowCount } = await client.query(`UPDATE ${TABLE} SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`, [id]);
    console.log(rowCount ? `Token ${id} revocado.` : `No hay ningún token activo con id ${id}.`);
  } else {
    console.log('Uso:\n  node scripts/mcp-token.mjs crear "Nombre del socio" [días]\n  node scripts/mcp-token.mjs listar\n  node scripts/mcp-token.mjs revocar <id>');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
