import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pointsLedger, user, type CefrLevel } from "@/db/schema";
import { daysBetween, practiceDateFor } from "./time";

export type Band = "beginner" | "intermediate" | "advanced";
export const BAND_LEVELS: Record<Band, CefrLevel[]> = {
  beginner: ["A1", "A2"],
  intermediate: ["B1", "B2"],
  advanced: ["C1", "C2"],
};
export const bandOf = (level: CefrLevel): Band =>
  (Object.keys(BAND_LEVELS) as Band[]).find((b) => BAND_LEVELS[b].includes(level))!;

/** Monday 00:00 UTC of the ISO week containing `now`. */
export function isoWeekStart(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

/** Streak to display: a missed day means the current streak is 0 until the next practice. */
export function displayStreak(
  current: number,
  lastPracticeDate: string | null,
  timeZone: string,
  now = new Date(),
) {
  if (!lastPracticeDate) return 0;
  return daysBetween(lastPracticeDate, practiceDateFor(timeZone, now)) <= 1 ? current : 0;
}

export type RankEntry = {
  userId: string;
  name: string;
  image: string | null;
  points: number;
  position: number;
  streak: number;
  isMe: boolean;
};

/**
 * FR-032: ranking by points (this ISO week, or all time) within the learner's level band
 * by default, or across everyone. Only display name + picture are exposed; opted-out and
 * suspended learners are not listed, but an opted-out learner still sees their own position.
 */
export async function getRanking(args: {
  userId: string;
  level: CefrLevel;
  scope: "band" | "overall";
  period: "week" | "all";
  now?: Date;
  top?: number;
}) {
  const now = args.now ?? new Date();
  const weekStart = isoWeekStart(now);
  const levels = args.scope === "band" ? BAND_LEVELS[bandOf(args.level)] : null;
  const points = sql<number>`coalesce(sum(${pointsLedger.amount}), 0)`.mapWith(Number);
  const rows = await db()
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      visible: user.rankingVisible,
      streak: user.currentStreak,
      last: user.lastPracticeDate,
      tz: user.timeZone,
      points,
    })
    .from(user)
    .leftJoin(
      pointsLedger,
      and(
        eq(pointsLedger.userId, user.id),
        args.period === "week" ? gte(pointsLedger.earnedAt, weekStart) : undefined,
      ),
    )
    .where(
      and(
        eq(user.emailVerified, true),
        sql`coalesce(${user.banned}, false) = false`,
        levels ? inArray(user.level, levels) : sql`${user.level} is not null`,
      ),
    )
    .groupBy(user.id);

  const visible = rows
    .filter((r) => r.visible)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const entries: RankEntry[] = visible.map((r, i) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    points: r.points,
    position: i + 1,
    streak: displayStreak(r.streak, r.last, r.tz, now),
    isMe: r.userId === args.userId,
  }));
  const meRow = rows.find((r) => r.userId === args.userId);
  const myPosition = meRow
    ? meRow.visible
      ? entries.find((e) => e.isMe)!.position
      : visible.filter((r) => r.points > meRow.points).length + 1
    : null;
  const total = visible.length + (meRow && !meRow.visible ? 1 : 0);
  const idx = entries.findIndex((e) => e.isMe);
  const around = idx >= 0 ? entries.slice(Math.max(0, idx - 2), idx + 3) : [];
  return {
    top: entries.slice(0, args.top ?? 10),
    around,
    me: meRow ? { position: myPosition!, points: meRow.points, visible: meRow.visible } : null,
    total,
    // Share of learners at or below you (e.g. "92% of learners behind you").
    behindPct: myPosition && total > 1 ? Math.round(((total - myPosition) / (total - 1)) * 100) : 0,
  };
}
