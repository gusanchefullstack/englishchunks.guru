import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { connect } from "./connect";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const { db, close } = connect(url);
const local = ["localhost", "127.0.0.1", "::1", "postgres"].includes(new URL(url).hostname);
const opts = { migrationsFolder: "src/db/migrations" };
await (local ? migratePg(db as never, opts) : migrateNeon(db as never, opts));
await close();
console.warn("migrations applied");
