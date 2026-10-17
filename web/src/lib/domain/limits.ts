import { sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import type { PlanTier, SubscriptionStatus } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { nextDayStart } from "./time";

export const TIER_LIMITS: Record<PlanTier, number> = { basic: 1, standard: 3, premium: 5 };

/** Admins test the app all day; finite so "N practices left" stays a plain number. */
export const ADMIN_DAILY_LIMIT = 99;

export type LimitInput = {
  billingActive: boolean;
  subscription: { tier: PlanTier; status: SubscriptionStatus } | null;
  earlyTester: boolean;
  isAdmin?: boolean;
};

/**
 * Practices per learner-local day (FR-060–FR-063, data-model subscription transitions).
 * - Billing inactive → everyone is on free Basic (1).
 * - Early testers keep free Basic after activation.
 * - App-managed trial → Basic limit (plan assumption).
 * - past_due keeps the paid tier while Stripe retries (spec edge case, analysis U1).
 * - expired / none after activation → 0 (must subscribe).
 */
export function getDailyLimit({
  billingActive,
  subscription,
  earlyTester,
  isAdmin = false,
}: LimitInput): number {
  if (isAdmin) return ADMIN_DAILY_LIMIT;
  if (!billingActive) return TIER_LIMITS.basic;
  const status = subscription?.status ?? "none";
  const tier = subscription?.tier ?? "basic";
  switch (status) {
    case "active":
    case "past_due":
      return TIER_LIMITS[tier];
    case "trialing":
      return TIER_LIMITS.basic;
    case "free_basic":
      return TIER_LIMITS.basic;
    case "canceled":
    case "expired":
    case "none":
      return earlyTester ? TIER_LIMITS.basic : 0;
  }
}

export function limitReachedError(limit: number, timeZone: string, now = new Date()) {
  return new AppError(
    "limit_reached",
    limit === 0
      ? "Your free trial has ended. Choose a plan to keep practicing."
      : `You've used all ${limit} practice${limit === 1 ? "" : "s"} for today.`,
    { resetsAt: nextDayStart(timeZone, now).toISOString(), limit },
  );
}

/**
 * Reserves one practice for the learner's day inside a transaction. Locks the learner row
 * (`SELECT … FOR UPDATE`) so concurrent starts can't exceed the limit.
 * `countUsed` counts sessions that already count toward today's limit.
 */
export async function reservePractice(
  tx: Tx,
  args: {
    userId: string;
    limit: number;
    timeZone: string;
    countUsed: (tx: Tx) => Promise<number>;
    now?: Date;
  },
): Promise<{ used: number; remaining: number }> {
  await tx.execute(sql`select id from "user" where id = ${args.userId} for update`);
  const used = await args.countUsed(tx);
  if (used >= args.limit) throw limitReachedError(args.limit, args.timeZone, args.now);
  return { used: used + 1, remaining: args.limit - used - 1 };
}
