import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { chunkSubmission, practiceSession, usageCounter, user } from "@/db/schema";

export async function getDashboard(now = new Date()) {
  const d = db();
  const since = new Date(now.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const [[users], [verified], [sessionsToday], [pending], usage] = await Promise.all([
    d.select({ n: count() }).from(user),
    d
      .select({ n: count() })
      .from(user)
      .where(and(eq(user.emailVerified, true), sql`coalesce(${user.banned}, false) = false`)),
    d
      .select({ n: count() })
      .from(practiceSession)
      .where(and(eq(practiceSession.status, "completed"), eq(practiceSession.practiceDate, today))),
    d.select({ n: count() }).from(chunkSubmission).where(eq(chunkSubmission.status, "pending")),
    d
      .select()
      .from(usageCounter)
      .where(gte(usageCounter.day, since))
      .orderBy(desc(usageCounter.day)),
  ]);
  const days = [...new Set(usage.map((u) => u.day))];
  const metric = (day: string, m: string) =>
    usage.find((u) => u.day === day && u.metric === m)?.value ?? 0;
  return {
    users: users?.n ?? 0,
    activeUsers: verified?.n ?? 0,
    sessionsToday: sessionsToday?.n ?? 0,
    pendingSubmissions: pending?.n ?? 0,
    usage: days.map((day) => ({
      day,
      llmIn: metric(day, "llm_tokens_in"),
      llmOut: metric(day, "llm_tokens_out"),
      ttsChars: metric(day, "tts_chars"),
      scoring: metric(day, "scoring_requests"),
    })),
  };
}
