import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { env } from "@/lib/env";
import { connect } from "./connect";
import type * as schema from "./schema";

export type Schema = typeof schema;
/** Driver-agnostic database type (Neon in production, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
/** A transaction handle has the same query API as the database. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

let instance: Db | undefined;

export function db(): Db {
  instance ??= connect(env().DATABASE_URL).db;
  return instance;
}

/** Test-only: point the app at a PGlite database. */
export function setDb(next: Db | undefined) {
  instance = next;
}
