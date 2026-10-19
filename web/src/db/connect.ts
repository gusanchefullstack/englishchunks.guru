import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import { logger } from "@/lib/logger";
import type { Db } from "./client";
import { withReadRetry } from "./retry";
import * as schema from "./schema";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

/**
 * Neon (WebSocket pool, real transactions with row locks) in the cloud; the standard `pg`
 * driver for a local Postgres (development, e2e). Returns the db and a close function.
 */
export function connect(url: string): { db: Db; close: () => Promise<void> } {
  const host = new URL(url).hostname;
  if (LOCAL_HOSTS.has(host)) {
    const pool = new PgPool({ connectionString: url, max: 10 });
    return {
      db: drizzlePg({ client: pool, schema, casing: "snake_case" }) as unknown as Db,
      close: () => pool.end(),
    };
  }
  neonConfig.webSocketConstructor = WebSocket;
  // Vercel reuses function instances and freezes them between requests; a socket that dies
  // while frozen fails the next query with a bare ErrorEvent. attachDatabasePool keeps the
  // instance alive until idle clients close (5 s here, not the 30 s default) before it sleeps.
  const pool = new NeonPool({ connectionString: url, idleTimeoutMillis: 5_000 });
  attachDatabasePool(pool);
  // An idle socket that dies with a suspended compute emits here; unhandled, it would crash.
  pool.on("error", (err: unknown) => logger.warn({ err: describe(err) }, "db.pool_error"));
  // Patch the instance (not a wrapper) so drizzle still sees a Pool and runs transactions on
  // pool.connect(), which stays un-retried.
  const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  pool.query = ((...args: unknown[]) => {
    if (typeof args.at(-1) === "function") return query(...args); // callback style: as is
    const first = args[0];
    const text = typeof first === "string" ? first : (first as { text?: unknown })?.text;
    return withReadRetry(text, () => query(...args), {
      onRetry: (attempt, err) => logger.warn({ attempt, err: describe(err) }, "db.retry"),
    });
  }) as typeof pool.query;
  return {
    db: drizzleNeon({ client: pool, schema, casing: "snake_case" }) as unknown as Db,
    close: () => pool.end(),
  };
}

/** ErrorEvents don't serialize usefully; keep the type/message only (never query params). */
function describe(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { type: (err as { type?: unknown })?.type ?? typeof err };
}
