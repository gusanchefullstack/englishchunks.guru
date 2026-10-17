import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";
import { notificationChannel, notificationType, pointsReason } from "./enums";

export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: pointsReason().notNull(),
    amount: integer().notNull(),
    refId: uuid(),
    earnedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    // Awards are idempotent per (user, reason, ref).
    uniqueIndex("points_ledger_award_uq").on(t.userId, t.reason, t.refId),
    index("points_ledger_user_time_idx").on(t.userId, t.earnedAt),
  ],
);

export const notification = pgTable(
  "notification",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType().notNull(),
    channel: notificationChannel().notNull(),
    message: text().notNull(),
    readAt: timestamp({ withTimezone: true }),
    sentOn: date({ mode: "string" }),
    ...timestamps,
  },
  (t) => [
    // FR-033: at most one reminder per learner per local day.
    uniqueIndex("notification_one_reminder_per_day_uq")
      .on(t.userId, t.sentOn)
      .where(sql`${t.type} = 'reminder'`),
    index("notification_user_idx").on(t.userId, t.readAt),
  ],
);
