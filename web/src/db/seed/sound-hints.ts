import { sql } from "drizzle-orm";
import hints from "@/content/sound-hints.json";
import type { Db } from "../client";
import { soundHint } from "../schema";

/** Upserts the curated IPA hint table from src/content/sound-hints.json (Principle II). */
export async function seedSoundHints(db: Db) {
  const rows = hints.sounds.map((s) => ({
    ipaSymbol: s.ipa,
    espeakSymbols: s.espeak,
    hint: s.hint,
    exampleWords: s.examples,
    version: hints.version,
  }));
  await db
    .insert(soundHint)
    .values(rows)
    .onConflictDoUpdate({
      target: soundHint.ipaSymbol,
      set: {
        espeakSymbols: sql`excluded.espeak_symbols`,
        hint: sql`excluded.hint`,
        exampleWords: sql`excluded.example_words`,
        version: sql`excluded.version`,
      },
    });
  return rows.length;
}
