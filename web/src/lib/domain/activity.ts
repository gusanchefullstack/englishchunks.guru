import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";

/** How stale `lastActiveAt` may get before a request refreshes it (keeps writes rare). */
export const ACTIVITY_REFRESH_MS = 15 * 60 * 1000;

export function isActivityStale(last: Date | string | null | undefined, now = new Date()) {
  if (!last) return true;
  return now.getTime() - new Date(last).getTime() >= ACTIVITY_REFRESH_MS;
}

/** Stamp the learner's last activity (admin "Last active"); the guard skips concurrent repeats. */
export async function touchLastActive(userId: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - ACTIVITY_REFRESH_MS);
  await db()
    .update(user)
    .set({ lastActiveAt: now, updatedAt: sql`${user.updatedAt}` }) // activity is not a profile edit
    .where(and(eq(user.id, userId), or(isNull(user.lastActiveAt), lt(user.lastActiveAt, cutoff))));
}
