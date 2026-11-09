/**
 * PostgreSQL data-access layer for the HASA GOLD API.
 *
 * Production: a `pg` Pool connected to Neon via DATABASE_URL (server-only env,
 * never exposed to the frontend / never prefixed with VITE_).
 *
 * Tests: `setDbForTesting(impl)` swaps in a PGlite-backed implementation so the
 * exact same route code runs against a real in-process Postgres engine.
 *
 * The exported `db` object exposes:
 *   - query(text, params)        -> { rows, rowCount, ... }   (pg-compatible)
 *   - transaction(async (tx) => ) -> commits on return, rolls back on throw
 *   - end()                      -> closes the pool
 *
 * `tx` exposes the same `query(text, params)` interface inside a transaction.
 */
import pg from "pg";

const { Pool } = pg;

let impl = null;

function createPgImpl() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL in the API environment (server-only).");
  }

  const ssl =
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: process.env.DATABASE_SSL_STRICT === "false" ? false : true };

  const pool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX || "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl,
  });

  pool.on("error", (err) => {
    console.error("Unexpected idle database pool error:", err);
  });

  return {
    pool,
    query: (text, params) => pool.query(text, params),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const tx = { query: (text, params) => client.query(text, params) };
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* ignore rollback errors */
        }
        throw err;
      } finally {
        client.release();
      }
    },
    async end() {
      await pool.end();
    },
  };
}

function ensureImpl() {
  if (!impl) impl = createPgImpl();
  return impl;
}

export const db = {
  query: (text, params) => ensureImpl().query(text, params),
  transaction: (fn) => ensureImpl().transaction(fn),
  async end() {
    if (impl) await impl.end();
  },
};

/** Replace the database implementation for tests (e.g. a PGlite instance). */
export function setDbForTesting(customImpl) {
  impl = customImpl;
}

/** Ping the database; throws if unreachable. Used at startup and by health checks. */
export async function pingDb() {
  const { rows } = await ensureImpl().query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}
