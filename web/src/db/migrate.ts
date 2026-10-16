import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

neonConfig.webSocketConstructor = WebSocket;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: url });
await migrate(drizzle({ client: pool }), { migrationsFolder: "src/db/migrations" });
await pool.end();
console.warn("migrations applied");
