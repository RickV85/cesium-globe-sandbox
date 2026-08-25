import { readFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";

/**
 * Postgres client (postgres.js).
 *
 * Server-only. `SUPABASE_DB_URL` must never be exposed with a NEXT_PUBLIC_
 * prefix -- it is a full database connection string.
 */

// Next's dev server re-evaluates modules on every edit. Without stashing the
// client on globalThis, each hot reload opens a fresh set of connections and
// Supabase eventually refuses new ones.
//
// The trade-off: the client outlives module reloads, so edits to the config
// below do NOT take effect until the dev server is restarted.
const globalForDb = globalThis as unknown as { __sql?: Sql };

export function getSql(): Sql {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error(
      "SUPABASE_DB_URL is not set. Add it to .env.local (server-side only, no NEXT_PUBLIC_ prefix).",
    );
  }

  if (!globalForDb.__sql) {
    const caPath = process.env.PGSSLROOTCERT;

    globalForDb.__sql = postgres(connectionString, {
      max: 5,
      idle_timeout: 30,
      connect_timeout: 10,

      // Set ssl explicitly rather than relying on sslmode in the URL, so the
      // behaviour does not depend on how that URL happens to be written.
      //
      // postgres.js follows libpq semantics: 'require' encrypts but does not
      // verify the certificate. That is what Supabase's pooler needs, because
      // its chain is not in Node's default trust store. Point PGSSLROOTCERT at
      // Supabase's CA bundle (Project Settings -> Database -> SSL certificate)
      // to get real verification before this leaves a dev machine.
      ssl: caPath ? { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true } : "require",

      // We connect to the SESSION-mode pooler (port 5432), where prepared
      // statements are fine. If this ever points at the TRANSACTION pooler
      // (6543), add `prepare: false` -- pgbouncer cannot hold their state.
    });
  }
  return globalForDb.__sql;
}
