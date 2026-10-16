import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { chunk, user } from "@/db/schema";
import { seedBase } from "@/db/seed/base";
import { seedDevChunks } from "@/db/seed/dev-chunks";
import { seedSoundHints } from "@/db/seed/sound-hints";

export async function seedAll(db: Db) {
  await seedBase(db);
  await seedSoundHints(db);
  await seedDevChunks(db);
}

let n = 0;
export async function createLearner(
  db: Db,
  overrides: Partial<typeof user.$inferInsert> = {},
): Promise<typeof user.$inferSelect> {
  n++;
  const [row] = await db
    .insert(user)
    .values({
      id: `learner-${n}`,
      name: `Learner ${n}`,
      email: `learner${n}@example.com`,
      username: `learner_${n}`,
      emailVerified: true,
      level: "B1",
      timeZone: "UTC",
      ageConfirmedAt: new Date(),
      ...overrides,
    })
    .returning();
  return row!;
}

export async function chunksAtLevel(db: Db, level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2") {
  return db.select().from(chunk).where(eq(chunk.level, level));
}
