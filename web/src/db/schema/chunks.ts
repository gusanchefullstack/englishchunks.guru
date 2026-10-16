import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";
import {
  auditStatus,
  cefrLevel,
  chunkSource,
  chunkStatus,
  chunkType,
  exampleRegister,
  register,
} from "./enums";

export const chunk = pgTable(
  "chunk",
  {
    id: id(),
    text: text().notNull(),
    normalizedText: text().notNull(),
    type: chunkType().notNull(),
    level: cefrLevel().notNull(),
    registers: register().array().notNull(),
    meaning: text().notNull(),
    usageNote: text().notNull(),
    ipa: text().notNull(),
    source: chunkSource().notNull().default("curated"),
    submittedBy: text().references(() => user.id, { onDelete: "set null" }),
    auditStatus: auditStatus().notNull().default("pending"),
    auditNotes: jsonb().$type<Record<string, unknown>>(),
    status: chunkStatus().notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("chunk_normalized_active_idx")
      .on(t.normalizedText)
      .where(sql`${t.status} = 'active'`),
    index("chunk_normalized_trgm_idx").using("gin", sql`${t.normalizedText} gin_trgm_ops`),
    index("chunk_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.text} || ' ' || ${t.meaning})`,
    ),
    index("chunk_level_idx").on(t.level),
    check("chunk_text_len", sql`char_length(${t.text}) between 1 and 80`),
    check("chunk_meaning_len", sql`char_length(${t.meaning}) between 1 and 300`),
    check("chunk_usage_len", sql`char_length(${t.usageNote}) between 1 and 400`),
    check("chunk_registers_nonempty", sql`cardinality(${t.registers}) >= 1`),
  ],
);

export const chunkExample = pgTable(
  "chunk_example",
  {
    id: id(),
    chunkId: uuid()
      .notNull()
      .references(() => chunk.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    text: text().notNull(),
    register: exampleRegister().notNull(),
    ipa: text().notNull(),
    ...timestamps,
  },
  (t) => [
    unique("chunk_example_position_uq").on(t.chunkId, t.position),
    check("chunk_example_position", sql`${t.position} between 1 and 3`),
    check("chunk_example_text_len", sql`char_length(${t.text}) between 1 and 200`),
  ],
);

/** Curated, versioned IPA → friendly hint table (Principle II). Source: src/content/sound-hints.json */
export const soundHint = pgTable(
  "sound_hint",
  {
    ipaSymbol: text().primaryKey(),
    espeakSymbols: text().array().notNull(),
    hint: text().notNull(),
    exampleWords: text().array().notNull(),
    version: integer().notNull(),
    ...timestamps,
  },
  (t) => [
    check("sound_hint_len", sql`char_length(${t.hint}) <= 160`),
    check("sound_hint_examples", sql`cardinality(${t.exampleWords}) between 2 and 4`),
  ],
);
