import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { setDb, type Db } from "@/db/client";
import * as schema from "@/db/schema";

/**
 * Fresh in-process Postgres with all real migrations applied, installed as the app DB.
 * Call once per test file (beforeAll) — PGlite is fast enough to isolate per file.
 */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite({ extensions: { pg_trgm } });
  const db = drizzle({ client, schema, casing: "snake_case" }) as unknown as Db;
  await migrate(drizzle({ client }), { migrationsFolder: "src/db/migrations" });
  setDb(db);
  return {
    db,
    close: async () => {
      setDb(undefined);
      await client.close();
    },
  };
}
