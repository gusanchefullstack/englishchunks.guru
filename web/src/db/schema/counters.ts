import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";

/** Per-key action counters for cost caps (e.g. scoring calls per session). Principle V. */
export const actionCounter = pgTable("action_counter", {
  key: text().primaryKey(),
  count: integer().notNull().default(0),
  ...timestamps,
});
