import "server-only";
import { and, eq, gt, isNull, lt, lte, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db/client";
import {
  appSetting,
  notification,
  practiceSession,
  subscription,
  user,
  type SubscriptionStatus,
} from "@/db/schema";
import { PaymentFailed, TrialEnding } from "@/emails/billing-notice";
import { renderEmail } from "@/emails/render";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { CHECKOUT_INTEGRATION_ID, priceIdFor, stripe, tierForPrice } from "@/lib/providers/billing";
import { emailProvider } from "@/lib/providers/email";
import { logAdmin } from "./audit";
import { practiceDateFor } from "./time";

const TRIAL_DAYS = 7;
const appUrl = () => env().BETTER_AUTH_URL.replace(/\/$/, "");

/**
 * data-model.md transitions for a Stripe subscription status. Canceled/ended subscriptions fall
 * back to free Basic for early testers, otherwise to expired (practice blocked).
 */
export function statusFromStripe(
  s: Stripe.Subscription.Status,
  earlyTester: boolean,
): SubscriptionStatus {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due"; // keeps the tier limit while Stripe retries (analysis U1)
    case "incomplete":
      return earlyTester ? "free_basic" : "none";
    default: // canceled, unpaid, incomplete_expired, paused
      return earlyTester ? "free_basic" : "expired";
  }
}

async function billingActive() {
  const [s] = await db().select({ a: appSetting.billingActive }).from(appSetting).limit(1);
  return s?.a ?? false;
}

/** Admin switch (FR-054). Activation marks every existing account as an early tester (FR-063). */
export async function setBillingActive(adminId: string, active: boolean) {
  await db().transaction(async (tx) => {
    await tx
      .update(appSetting)
      .set({ billingActive: active, billingChangedBy: adminId, billingChangedAt: new Date() })
      .where(eq(appSetting.id, 1));
    if (active) {
      await tx.update(user).set({ earlyTester: true }).where(eq(user.earlyTester, false));
      await tx.execute(sql`insert into subscription (user_id, tier, status)
        select id, 'basic', 'free_basic' from "user" on conflict (user_id) do nothing`);
    }
    await logAdmin(adminId, active ? "billing.activate" : "billing.deactivate", null, {}, tx);
  });
}

/** Post-activation sign-ups start an app-managed 7-day trial on the Basic limit (no card). */
export async function startTrialIfBillingActive(userId: string, now = new Date()) {
  if (!(await billingActive())) return;
  await db()
    .insert(subscription)
    .values({
      userId,
      tier: "basic",
      status: "trialing",
      trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000),
    })
    .onConflictDoNothing();
}

async function ensureCustomer(userId: string) {
  const [row] = await db().select().from(subscription).where(eq(subscription.userId, userId));
  if (row?.stripeCustomerId) return row.stripeCustomerId;
  const [u] = await db()
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId));
  if (!u) throw new AppError("not_found", "User not found.");
  const customer = await stripe().customers.create({
    email: u.email,
    name: u.name,
    metadata: { userId },
  });
  await db()
    .insert(subscription)
    .values({ userId, stripeCustomerId: customer.id, status: "none" })
    .onConflictDoUpdate({ target: subscription.userId, set: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Hosted Checkout in subscription mode — no Stripe trial (the trial is app-managed). */
export async function createCheckout(userId: string, tier: "basic" | "standard" | "premium") {
  if (!(await billingActive()))
    throw new AppError(
      "billing_inactive",
      "Plans aren't available yet — everything is free for now.",
    );
  const [row] = await db().select().from(subscription).where(eq(subscription.userId, userId));
  if (row?.stripeSubscriptionId && ["active", "past_due"].includes(row.status)) {
    throw new AppError("conflict", "You already have a plan. Use “Manage plan” to change it.");
  }
  const customer = await ensureCustomer(userId);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price: priceIdFor(tier), quantity: 1 }],
    success_url: `${appUrl()}/billing?checkout=success`,
    cancel_url: `${appUrl()}/billing?checkout=cancelled`,
    integration_identifier: CHECKOUT_INTEGRATION_ID,
  } as Stripe.Checkout.SessionCreateParams);
  if (!session.url) throw new AppError("unavailable", "Checkout is unavailable right now.");
  return { url: session.url };
}

export async function createPortal(userId: string) {
  const [row] = await db().select().from(subscription).where(eq(subscription.userId, userId));
  if (!row?.stripeCustomerId) throw new AppError("not_found", "No billing account yet.");
  const portal = await stripe().billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${appUrl()}/billing`,
  });
  return { url: portal.url };
}

/** Resolve the owner through the Stripe Customer ID (metadata only as a fallback). */
async function rowForCustomer(customerId: string, fallbackUserId?: string | null) {
  const [byCustomer] = await db()
    .select()
    .from(subscription)
    .where(eq(subscription.stripeCustomerId, customerId));
  if (byCustomer) return byCustomer;
  if (!fallbackUserId) return null;
  const [byUser] = await db()
    .select()
    .from(subscription)
    .where(eq(subscription.userId, fallbackUserId));
  return byUser ?? null;
}

const idOf = (x: string | { id: string } | null | undefined) =>
  typeof x === "string" ? x : (x?.id ?? null);

/** Sync our row from a Stripe Subscription (re-fetched with the payment method expanded). */
export async function syncSubscription(subscriptionId: string) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method"],
  });
  const customerId = idOf(sub.customer)!;
  const row = await rowForCustomer(customerId, sub.metadata?.userId);
  if (!row) {
    logger.warn({ event: "stripe.unknown_customer" }, "subscription for unknown customer");
    return;
  }
  const [u] = await db()
    .select({ earlyTester: user.earlyTester })
    .from(user)
    .where(eq(user.id, row.userId));
  const item = sub.items.data[0];
  const pm = typeof sub.default_payment_method === "object" ? sub.default_payment_method : null;
  const card = pm?.card;
  await db()
    .update(subscription)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      tier: tierForPrice(item?.price.id) ?? row.tier,
      status: statusFromStripe(sub.status, u?.earlyTester ?? false),
      // Since API 2025-03-31 (basil) the period lives on subscription items.
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: null, // paid now; the app-managed trial is over
      // Display-only payment method summary (FR-052). Nothing else card-related is stored.
      pmBrand: card?.brand ?? row.pmBrand,
      pmLast4: card?.last4 ?? row.pmLast4,
      pmExpMonth: card?.exp_month ?? row.pmExpMonth,
      pmExpYear: card?.exp_year ?? row.pmExpYear,
    })
    .where(eq(subscription.userId, row.userId));
}

/** Webhook dispatch (FR-062). Unknown events are acknowledged and ignored. */
export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.mode === "subscription" && s.subscription && s.payment_status !== "unpaid")
        await syncSubscription(idOf(s.subscription)!);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object.id);
      return;
    case "invoice.paid":
    case "invoice.payment_failed": {
      const inv = event.data.object;
      const subId = idOf(inv.parent?.subscription_details?.subscription);
      if (subId) await syncSubscription(subId);
      if (event.type === "invoice.payment_failed") await notifyPaymentFailed(idOf(inv.customer));
      return;
    }
    default:
      return;
  }
}

async function notifyPaymentFailed(customerId: string | null) {
  if (!customerId) return;
  const row = await rowForCustomer(customerId);
  if (!row) return;
  const [u] = await db()
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, row.userId));
  if (!u) return;
  await db().insert(notification).values({
    userId: row.userId,
    type: "billing",
    channel: "in_app",
    message: "Your payment didn't go through. Please update your payment method.",
  });
  const content = await renderEmail(PaymentFailed({ name: u.name, url: `${appUrl()}/billing` }));
  await emailProvider()
    .send({ to: u.email, subject: "We couldn't take your payment", ...content })
    .catch(() => undefined);
}

/** Daily job (T143): expire trials, warn a day before, abandon stale sessions. */
export async function runDailyBilling(now = new Date()) {
  const d = db();
  const expired = await d
    .update(subscription)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscription.status, "trialing"),
        lt(subscription.trialEndsAt, now),
        isNull(subscription.stripeSubscriptionId),
      ),
    )
    .returning({ userId: subscription.userId });

  const soon = await d
    .select({ userId: subscription.userId, name: user.name, email: user.email, tz: user.timeZone })
    .from(subscription)
    .innerJoin(user, eq(user.id, subscription.userId))
    .where(
      and(
        eq(subscription.status, "trialing"),
        gt(subscription.trialEndsAt, now),
        lte(subscription.trialEndsAt, new Date(now.getTime() + 86_400_000)),
      ),
    );
  let warned = 0;
  for (const t of soon) {
    const sentOn = practiceDateFor(t.tz, now);
    const [already] = await d
      .select({ id: notification.id })
      .from(notification)
      .where(
        and(
          eq(notification.userId, t.userId),
          eq(notification.type, "billing"),
          eq(notification.sentOn, sentOn),
        ),
      );
    if (already) continue;
    await d.insert(notification).values({
      userId: t.userId,
      type: "billing",
      channel: "email",
      message: "Trial ending",
      sentOn,
    });
    const content = await renderEmail(TrialEnding({ name: t.name, url: `${appUrl()}/billing` }));
    await emailProvider()
      .send({ to: t.email, subject: "Your free trial ends tomorrow", ...content })
      .catch(() => undefined);
    warned++;
  }

  const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000).toISOString().slice(0, 10);
  const abandoned = await d
    .update(practiceSession)
    .set({ status: "abandoned" })
    .where(
      and(eq(practiceSession.status, "in_progress"), lt(practiceSession.practiceDate, twoDaysAgo)),
    )
    .returning({ id: practiceSession.id });
  return {
    expiredTrials: expired.length,
    trialWarnings: warned,
    abandonedSessions: abandoned.length,
  };
}

export async function getBillingView(userId: string, now = new Date()) {
  const [[row], active] = await Promise.all([
    db().select().from(subscription).where(eq(subscription.userId, userId)),
    billingActive(),
  ]);
  const [u] = await db()
    .select({ earlyTester: user.earlyTester })
    .from(user)
    .where(eq(user.id, userId));
  return {
    billingActive: active,
    earlyTester: u?.earlyTester ?? false,
    tier: row?.tier ?? "basic",
    status: row?.status ?? (active ? "none" : "free_basic"),
    trialEndsAt: row?.trialEndsAt ?? null,
    trialDaysLeft: row?.trialEndsAt
      ? Math.max(0, Math.ceil((row.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
      : null,
    renewsAt: row?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
    hasCustomer: Boolean(row?.stripeCustomerId),
  };
}
