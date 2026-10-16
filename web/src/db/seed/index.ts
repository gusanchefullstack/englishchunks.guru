import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { Db } from "../client";
import * as schema from "../schema";
import { seedBase } from "./base";
import { seedDevChunks } from "./dev-chunks";
import { seedSoundHints } from "./sound-hints";

neonConfig.webSocketConstructor = WebSocket;
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: url });
const db = drizzle({ client: pool, schema, casing: "snake_case" }) as unknown as Db;
await seedBase(db);
const hints = await seedSoundHints(db);
const chunks = process.env.SEED_DEV_CHUNKS === "0" ? 0 : await seedDevChunks(db);
await pool.end();
console.warn(`seeded: base, ${hints} sound hints, ${chunks} dev chunks`);
