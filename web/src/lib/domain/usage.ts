import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { usageCounter } from "@/db/schema";

export type UsageMetric = "llm_tokens_in" | "llm_tokens_out" | "tts_chars" | "scoring_requests";

/** Adds to today's (UTC) usage counter; best-effort, never blocks the user flow. */
export async function recordUsage(metric: UsageMetric, amount: number, now = new Date()) {
  if (!amount) return;
  const day = now.toISOString().slice(0, 10);
  await db()
    .insert(usageCounter)
    .values({ day, metric, value: amount })
    .onConflictDoUpdate({
      target: [usageCounter.day, usageCounter.metric],
      set: { value: sql`${usageCounter.value} + ${amount}` },
    });
}
