import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";

export const LEVEL_LABELS = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
  C2: "Proficient",
} as const;

export async function getShellSummary(userId: string) {
  const [row] = await db()
    .select({
      name: user.name,
      level: user.level,
      currentStreak: user.currentStreak,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, userId));
  return row ?? null;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
