import { and, avg, countDistinct, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { practiceSession, user } from "@/db/schema";
import { displayStreak } from "./ranking";
import { practiceDateFor } from "./time";

export type RangeDays = 7 | 30 | 90;

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** FR-030: daily scores, streaks, points, chunks learned, try-1→try-2 trend, this week. */
export async function getProgress(userId: string, range: RangeDays, now = new Date()) {
  const d = db();
  const [u] = await d.select().from(user).where(eq(user.id, userId));
  if (!u) throw new Error("user not found");
  const today = practiceDateFor(u.timeZone, now);
  const from = shiftDate(today, -(range - 1));
  const prevFrom = shiftDate(from, -range);

  const completed = and(
    eq(practiceSession.userId, userId),
    eq(practiceSession.status, "completed"),
  );
  const perDay = await d
    .select({
      date: practiceSession.practiceDate,
      score: sql<number>`max(${practiceSession.dailyScore})`.mapWith(Number),
      improvement: sql<
        number | null
      >`avg(${practiceSession.speak2Score} - ${practiceSession.speak1Score})`.mapWith((v) =>
        v === null ? null : Number(v),
      ),
    })
    .from(practiceSession)
    .where(and(completed, gte(practiceSession.practiceDate, prevFrom)))
    .groupBy(practiceSession.practiceDate);

  const byDate = new Map(perDay.map((r) => [r.date, r]));
  const days = Array.from({ length: range }, (_, i) => {
    const date = shiftDate(from, i);
    return {
      date,
      score: byDate.get(date)?.score ?? null,
      improvement: byDate.get(date)?.improvement ?? null,
    };
  });
  const inRange = perDay.filter((r) => r.date >= from);
  const inPrev = perDay.filter((r) => r.date >= prevFrom && r.date < from);
  const average = (xs: number[]) =>
    xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  const avgScore = average(inRange.map((r) => r.score));
  const prevAvg = average(inPrev.map((r) => r.score));
  const improvements = inRange.map((r) => r.improvement).filter((v): v is number => v !== null);

  const [{ chunks } = { chunks: 0 }] = await d
    .select({ chunks: countDistinct(practiceSession.chunkId) })
    .from(practiceSession)
    .where(completed);

  // This week (Mon–Sun) in the learner's zone.
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monday = shiftDate(today, -dow);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(monday, i);
    return { date, practiced: byDate.has(date), future: date > today };
  });
  const [{ weekAvg } = { weekAvg: null }] = await d
    .select({ weekAvg: avg(practiceSession.dailyScore) })
    .from(practiceSession)
    .where(
      and(
        completed,
        gte(practiceSession.practiceDate, monday),
        isNotNull(practiceSession.dailyScore),
      ),
    );

  return {
    range,
    days,
    currentStreak: displayStreak(u.currentStreak, u.lastPracticeDate, u.timeZone, now),
    longestStreak: u.longestStreak,
    totalPoints: u.totalPoints,
    averageScore: avgScore,
    averageChange: avgScore !== null && prevAvg !== null ? avgScore - prevAvg : null,
    improvementTrend: average(improvements),
    chunksLearned: chunks,
    week,
    weekPracticed: week.filter((w) => w.practiced).length,
    weekAverage: weekAvg === null ? null : Math.round(Number(weekAvg)),
  };
}
