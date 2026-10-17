import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";

export { LEVEL_LABELS } from "@/lib/levels";

export async function getShellSummary(userId: string) {
  const [row] = await db()
    .select({
      name: user.name,
      level: user.level,
      currentStreak: user.currentStreak,
      lastPracticeDate: user.lastPracticeDate,
      timeZone: user.timeZone,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, userId));
  if (!row) return null;
  const { displayStreak } = await import("./ranking");
  return {
    ...row,
    currentStreak: displayStreak(row.currentStreak, row.lastPracticeDate, row.timeZone),
  };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
