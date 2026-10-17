import { boolean, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { timestamps } from "./columns";
import { planTier, subscriptionStatus } from "./enums";

export const subscription = pgTable("subscription", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  tier: planTier().notNull().default("basic"),
  status: subscriptionStatus().notNull().default("free_basic"),
  stripeCustomerId: text(),
  stripeSubscriptionId: text(),
  trialEndsAt: timestamp({ withTimezone: true }),
  currentPeriodEnd: timestamp({ withTimezone: true }),
  cancelAtPeriodEnd: boolean().notNull().default(false),
  // Display-only payment method summary (FR-052). No card data is ever stored.
  pmBrand: text(),
  pmLast4: text(),
  pmExpMonth: smallint(),
  pmExpYear: smallint(),
  ...timestamps,
});

/** Processed Stripe webhook events (idempotency, FR-062). */
export const stripeEvent = pgTable("stripe_event", {
  id: text().primaryKey(),
  type: text().notNull(),
  processedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
