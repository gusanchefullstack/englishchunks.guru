import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { chunk } from "./chunks";
import { id, timestamps } from "./columns";
import { attemptItem, sessionOrigin, sessionStatus, sessionStep } from "./enums";

const score0to100 = (col: string) => sql.raw(`${col} is null or ${col} between 0 and 100`);

export const practiceSession = pgTable(
  "practice_session",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chunkId: uuid()
      .notNull()
      .references(() => chunk.id),
    origin: sessionOrigin().notNull(),
    practiceDate: date({ mode: "string" }).notNull(),
    step: sessionStep().notNull().default("learn"),
    status: sessionStatus().notNull().default("in_progress"),
    countsTowardLimit: boolean().notNull().default(true),
    speak1Score: smallint(),
    speak2Score: smallint(),
    writeScore: smallint(),
    readAloudScore: smallint(),
    dailyScore: smallint(),
    partial: boolean().notNull().default(false),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // One daily-origin session per learner per local practice day.
    uniqueIndex("practice_session_one_daily_idx")
      .on(t.userId, t.practiceDate)
      .where(sql`${t.origin} = 'daily'`),
    index("practice_session_user_date_idx").on(t.userId, t.practiceDate),
    index("practice_session_user_chunk_idx").on(t.userId, t.chunkId),
    check("ps_speak1", score0to100("speak1_score")),
    check("ps_speak2", score0to100("speak2_score")),
    check("ps_write", score0to100("write_score")),
    check("ps_read", score0to100("read_aloud_score")),
    check("ps_daily", score0to100("daily_score")),
  ],
);

export type SoundResult = { ipa: string; score: number; count: number };

/** One scored recording. There is deliberately no audio column (FR-019). */
export const attempt = pgTable(
  "attempt",
  {
    id: id(),
    sessionId: uuid()
      .notNull()
      .references(() => practiceSession.id, { onDelete: "cascade" }),
    step: sessionStep().notNull(),
    item: attemptItem().notNull(),
    expectedText: text().notNull(),
    score: smallint().notNull(),
    wordAccuracy: smallint().notNull(),
    phonemeAccuracy: smallint().notNull(),
    fluency: smallint().notNull(),
    soundResults: jsonb().$type<SoundResult[]>().notNull(),
    weakestSounds: text().array().notNull(),
    tip: text().notNull(),
    hintTableVersion: integer().notNull(),
    ...timestamps,
  },
  (t) => [
    unique("attempt_session_step_item_uq").on(t.sessionId, t.step, t.item),
    check("attempt_step", sql`${t.step} in ('speak_1', 'speak_2', 'read_aloud')`),
    check("attempt_score", sql`${t.score} between 0 and 100`),
    check("attempt_weakest", sql`cardinality(${t.weakestSounds}) <= 3`),
  ],
);

export const writingResult = pgTable(
  "writing_result",
  {
    id: id(),
    sessionId: uuid()
      .notNull()
      .references(() => practiceSession.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    original: text().notNull(),
    corrected: text().notNull(),
    usageGrade: smallint().notNull(),
    grammarGrade: smallint().notNull(),
    usesChunk: boolean().notNull(),
    explanation: text().notNull(),
    ...timestamps,
  },
  (t) => [
    unique("writing_result_position_uq").on(t.sessionId, t.position),
    check("wr_position", sql`${t.position} between 1 and 3`),
    check("wr_original_len", sql`char_length(${t.original}) between 1 and 300`),
    check(
      "wr_grades",
      sql`${t.usageGrade} between 0 and 100 and ${t.grammarGrade} between 0 and 100`,
    ),
  ],
);
