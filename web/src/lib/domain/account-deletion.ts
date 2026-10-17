import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subscription, user } from "@/db/schema";
import { logger } from "@/lib/logger";
import { cancelSubscriptionNow } from "@/lib/providers/billing";
import { storage } from "@/lib/providers/storage";

/**
 * FR-008: erase a learner immediately. External resources first (so a failure leaves the
 * account intact and retryable), then a hard delete that cascades to sessions, attempts,
 * writing results, ledger, notifications, subscription and private audio rows. Chunks the
 * learner submitted stay in the library with `submitted_by` set to NULL.
 */
export async function deleteAccount(userId: string) {
  const d = db();
  const [u] = await d.select({ imageKey: user.imageKey }).from(user).where(eq(user.id, userId));
  if (!u) return;
  const [sub] = await d.select().from(subscription).where(eq(subscription.userId, userId));
  if (sub?.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(sub.status)) {
    await cancelSubscriptionNow(sub.stripeSubscriptionId);
  }
  const store = storage();
  if (u.imageKey) await store.delete(u.imageKey);
  await store.deletePrefix(`tts/u/${userId}/`);
  await d.delete(user).where(eq(user.id, userId));
  logger.info({ event: "account.deleted" }, "account deleted"); // no personal data logged
}
