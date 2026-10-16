import "server-only";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Schema = typeof schema;
/** Driver-agnostic database type (Neon in production, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
/** A transaction handle has the same query API as the database. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

let instance: Db | undefined;

function createNeonDb(): Db {
  // Node 22+ has a global WebSocket, required for transactions with row locks.
  neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({ connectionString: env().DATABASE_URL });
  return drizzleNeon({ client: pool, schema, casing: "snake_case" }) as unknown as Db;
}

export function db(): Db {
  instance ??= createNeonDb();
  return instance;
}

/** Test-only: point the app at a PGlite database. */
export function setDb(next: Db | undefined) {
  instance = next;
}
