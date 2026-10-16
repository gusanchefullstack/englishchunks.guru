import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";

export const voice = pgTable("voice", {
  id: text().primaryKey(),
  providerVoiceId: text().notNull(),
  label: text().notNull(),
  gender: text().notNull(),
  active: boolean().notNull().default(true),
  ...timestamps,
});

export type ScoreWeights = { speaking: number; writing: number; read_aloud: number };

/** Singleton row (id = 1). */
export const appSetting = pgTable(
  "app_setting",
  {
    id: smallint().primaryKey().default(1),
    billingActive: boolean().notNull().default(false),
    billingChangedBy: text().references(() => user.id, { onDelete: "set null" }),
    billingChangedAt: timestamp({ withTimezone: true }),
    accountCap: integer().notNull().default(200),
    scoreWeights: jsonb()
      .$type<ScoreWeights>()
      .notNull()
      .default({ speaking: 40, writing: 30, read_aloud: 30 }),
    ...timestamps,
  },
  (t) => [
    check("app_setting_singleton", sql`${t.id} = 1`),
    check("app_setting_cap_nonneg", sql`${t.accountCap} >= 0`),
  ],
);

export const usageCounter = pgTable(
  "usage_counter",
  {
    day: date({ mode: "string" }).notNull(),
    metric: text().notNull(),
    value: bigint({ mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.metric] })],
);

export const adminAuditLog = pgTable("admin_audit_log", {
  id: id(),
  actorId: text().references(() => user.id, { onDelete: "set null" }),
  action: text().notNull(),
  targetId: text(),
  details: jsonb().$type<Record<string, unknown>>(),
  ...timestamps,
});
