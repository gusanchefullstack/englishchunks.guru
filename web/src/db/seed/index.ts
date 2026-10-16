import { connect } from "../connect";
import { seedBase } from "./base";
import { seedDevChunks } from "./dev-chunks";
import { seedSoundHints } from "./sound-hints";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const { db, close } = connect(url);
await seedBase(db);
const hints = await seedSoundHints(db);
const chunks = process.env.SEED_DEV_CHUNKS === "0" ? 0 : await seedDevChunks(db);
await close();
console.warn(`seeded: base, ${hints} sound hints, ${chunks} dev chunks`);
