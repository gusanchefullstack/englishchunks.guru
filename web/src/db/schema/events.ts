import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";
import { id } from "./columns";
import { practiceEventKind, sessionStep } from "./enums";
import { practiceSession } from "./sessions";

/**
 * Practice diagnostics (FR-074): one row when a learner hits a blocked microphone, an unusable
 * recording, a failed upload or a broken page. Allow-listed codes only — no audio, no free text.
 * Pruned after 30 days by the hourly cron.
 */
export const practiceEvent = pgTable(
  "practice_event",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: uuid().references(() => practiceSession.id, { onDelete: "cascade" }),
    kind: practiceEventKind().notNull(),
    step: sessionStep(),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("practice_event_user_idx").on(t.userId, t.createdAt),
    index("practice_event_created_idx").on(t.createdAt),
    check("practice_event_reason", sql`${t.reason} is null or length(${t.reason}) <= 40`),
  ],
);
