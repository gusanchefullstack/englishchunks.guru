import "server-only";
import Stripe from "stripe";
import type { PlanTier } from "@/db/schema";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

let client: Stripe | undefined;

/** One Stripe client instance (no global key). Use a restricted key (rk_…) in production. */
export function stripe(): Stripe {
  client ??= new Stripe(env().STRIPE_SECRET_KEY || "rk_test_placeholder", {
    apiVersion: "2026-08-26.dahlia",
    maxNetworkRetries: 2,
    timeout: 15_000,
    appInfo: { name: "englishchunks.guru" },
  });
  return client;
}

/** Test-only override. */
export function setStripe(next: Stripe | undefined) {
  client = next;
}

/** One Stripe Product per plan; one monthly Price each (ids from env). */
export function priceIdFor(tier: PlanTier) {
  const e = env();
  const id = {
    basic: e.STRIPE_PRICE_BASIC,
    standard: e.STRIPE_PRICE_STANDARD,
    premium: e.STRIPE_PRICE_PREMIUM,
  }[tier];
  if (!id) throw new AppError("unavailable", "This plan isn't available yet.");
  return id;
}

export function tierForPrice(priceId: string | null | undefined): PlanTier | null {
  const e = env();
  if (priceId === e.STRIPE_PRICE_BASIC) return "basic";
  if (priceId === e.STRIPE_PRICE_STANDARD) return "standard";
  if (priceId === e.STRIPE_PRICE_PREMIUM) return "premium";
  return null;
}

/** Fixed label for Checkout analytics (Stripe recommends an 8-letter random suffix). */
export const CHECKOUT_INTEGRATION_ID = "englishchunks-subscribe-qhtvmrkz";

/** Cancels a subscription immediately (account deletion, FR-008). Already-gone is fine. */
export async function cancelSubscriptionNow(subscriptionId: string) {
  try {
    await stripe().subscriptions.cancel(subscriptionId);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.statusCode === 404) return;
    throw new AppError("unavailable", "Could not cancel the subscription. Please try again.");
  }
}
