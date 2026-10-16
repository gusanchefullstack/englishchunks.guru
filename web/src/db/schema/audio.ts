import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { timestamps } from "./columns";
import { voice } from "./settings";

/**
 * TTS cache (research R9). Shared chunk/example audio has owner_id NULL and lives under
 * tts/shared/; a learner's corrected-sentence audio is private (tts/u/<userId>/) and is deleted
 * with the account (FR-008).
 */
export const audioClip = pgTable("audio_clip", {
  cacheKey: text().primaryKey(),
  ownerId: text().references(() => user.id, { onDelete: "cascade" }),
  text: text().notNull(),
  voiceId: text()
    .notNull()
    .references(() => voice.id),
  storageKey: text().notNull(),
  status: text().$type<"generating" | "ready" | "failed">().notNull().default("generating"),
  byteSize: integer(),
  ...timestamps,
});
