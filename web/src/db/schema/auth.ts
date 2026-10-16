import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { cefrLevel, theme } from "./enums";

/**
 * Better Auth `user` table (core + username + admin plugins) extended with learner fields.
 * - `name` is the learner's display name (1–40 chars, shown in rankings).
 * - Status is derived, not stored: unverified = !emailVerified, suspended = banned.
 */
export const user = pgTable(
  "user",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    // username plugin
    username: text().unique(),
    displayUsername: text(),
    // admin plugin
    role: text().notNull().default("learner"),
    banned: boolean().default(false),
    banReason: text(),
    banExpires: timestamp({ withTimezone: true }),
    // learner fields (data-model.md)
    ageConfirmedAt: timestamp({ withTimezone: true }),
    level: cefrLevel(),
    motherTongue: text(),
    timeZone: text().notNull().default("UTC"),
    imageKey: text(),
    voiceId: text(),
    theme: theme().notNull().default("system"),
    rankingVisible: boolean().notNull().default(true),
    remindersEnabled: boolean().notNull().default(true),
    reminderHour: smallint().notNull().default(19),
    earlyTester: boolean().notNull().default(false),
    totalPoints: integer().notNull().default(0),
    currentStreak: integer().notNull().default(0),
    longestStreak: integer().notNull().default(0),
    lastPracticeDate: date({ mode: "string" }),
    lastActiveAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("user_username_lower_idx").on(sql`lower(${t.username})`),
    index("user_level_idx").on(t.level),
    check("user_name_len", sql`char_length(${t.name}) between 1 and 40`),
    check("user_username_fmt", sql`${t.username} is null or ${t.username} ~ '^[a-z0-9_]{3,24}$'`),
    check("user_reminder_hour", sql`${t.reminderHour} between 0 and 23`),
    check("user_points_nonneg", sql`${t.totalPoints} >= 0`),
    check("user_streak_nonneg", sql`${t.currentStreak} >= 0`),
    check("user_longest_ge_current", sql`${t.longestStreak} >= ${t.currentStreak}`),
    check("user_role_valid", sql`${t.role} in ('learner', 'admin')`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text(),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Better Auth database-backed rate limiting (auth endpoints). */
export const rateLimit = pgTable("rate_limit", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});
