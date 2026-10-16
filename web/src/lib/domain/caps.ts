import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { actionCounter } from "@/db/schema";
import { AppError } from "@/lib/errors";

/** Per-session cost caps (constitution V): required work is 11 recordings and 1 writing check. */
export const CAPS = {
  scoringPerSession: 40,
  writingChecksPerSession: 5,
} as const;

/** Atomically increments `key` and throws `limit_reached` once `max` is exceeded. */
export async function consume(key: string, max: number, message: string) {
  const [row] = await db()
    .insert(actionCounter)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: actionCounter.key,
      set: { count: sql`${actionCounter.count} + 1` },
    })
    .returning({ count: actionCounter.count });
  if ((row?.count ?? 0) > max) throw new AppError("limit_reached", message);
}
