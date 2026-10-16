import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import type { Db } from "./client";
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
  const pool = new NeonPool({ connectionString: url });
  return {
    db: drizzleNeon({ client: pool, schema, casing: "snake_case" }) as unknown as Db,
    close: () => pool.end(),
  };
}
