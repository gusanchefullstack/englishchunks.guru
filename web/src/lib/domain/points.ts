import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { pointsLedger, user } from "@/db/schema";

const MILESTONES: Record<number, number> = { 3: 5, 7: 15, 30: 50, 100: 150 };
export const SUBMISSION_POINTS = 20;

export const sessionPoints = (dailyScore: number | null) => Math.round((dailyScore ?? 0) / 10);
export const milestoneFor = (streak: number) => MILESTONES[streak] ?? 0;

type Reason = "session" | "streak_milestone" | "submission_accepted" | "admin_adjustment";

/** Idempotent award: a repeated (user, reason, ref) adds nothing. Keeps total_points in sync. */
export async function award(
  tx: Tx,
  userId: string,
  reason: Reason,
  amount: number,
  refId: string,
  at = new Date(),
) {
  if (amount <= 0) return 0;
  const inserted = await tx
    .insert(pointsLedger)
    .values({ userId, reason, amount, refId, earnedAt: at })
    .onConflictDoNothing()
    .returning({ id: pointsLedger.id });
  if (!inserted.length) return 0;
  await tx
    .update(user)
    .set({ totalPoints: sql`${user.totalPoints} + ${amount}` })
    .where(eq(user.id, userId));
  return amount;
}

/** Called inside completeSession: session points + any milestone reached by the new streak. */
export async function awardSession(
  tx: Tx,
  s: { id: string; userId: string; dailyScore: number | null; completedAt: Date | null },
  newStreak: number,
) {
  const at = s.completedAt ?? new Date();
  await award(tx, s.userId, "session", sessionPoints(s.dailyScore), s.id, at);
  await award(tx, s.userId, "streak_milestone", milestoneFor(newStreak), s.id, at);
}
