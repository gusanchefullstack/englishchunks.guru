import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** Stripe REST helper. US8 extends this with Checkout and the Customer Portal. */
async function stripe(path: string, init: { method: string; form?: Record<string, string> }) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${env().STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init.form ? new URLSearchParams(init.form) : undefined,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) throw new AppError("unavailable", "Billing is unavailable right now.");
  return res;
}

/** Cancels a subscription immediately (account deletion, FR-008). Already-gone is fine. */
export async function cancelSubscriptionNow(subscriptionId: string) {
  const res = await stripe(`subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404)
    throw new AppError("unavailable", "Could not cancel the subscription. Please try again.");
}
