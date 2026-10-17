import "server-only";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db/client";
import { stripeEvent } from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { stripe } from "@/lib/providers/billing";
import { handleStripeEvent } from "./subscription";

/**
 * Verify the signature, then process each event once (idempotent by event id). If processing
 * fails the claim is released and a 500 makes Stripe retry.
 */
export async function processWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ status: number }> {
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      rawBody,
      signature ?? "",
      env().STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return { status: 400 };
  }
  const claimed = await db()
    .insert(stripeEvent)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: stripeEvent.id });
  if (!claimed.length) return { status: 200 }; // already processed
  try {
    await handleStripeEvent(event);
    return { status: 200 };
  } catch (err) {
    await db().delete(stripeEvent).where(eq(stripeEvent.id, event.id));
    logger.error(
      { event: "stripe.webhook_failed", type: event.type, err: (err as Error).name },
      "webhook processing failed",
    );
    return { status: 500 };
  }
}
