import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { cefrLevels, chunk, practiceSession, type CefrLevel } from "@/db/schema";

const practicable = (level: CefrLevel) =>
  and(
    eq(chunk.level, level),
    eq(chunk.status, "active"),
    inArray(chunk.auditStatus, ["passed", "admin_approved"]),
  );

/** The learner's level first, then the nearest ones (the easier level wins a tie). */
export function levelsByDistance(level: CefrLevel): CefrLevel[] {
  const i = cefrLevels.indexOf(level);
  return [...cefrLevels].sort(
    (a, b) =>
      Math.abs(cefrLevels.indexOf(a) - i) - Math.abs(cefrLevels.indexOf(b) - i) ||
      cefrLevels.indexOf(a) - cefrLevels.indexOf(b),
  );
}

/**
 * Daily chunk (FR-010): a practicable chunk at the learner's level they have never practiced;
 * when none is left, the least-recently practiced one (spec edge case). A level with no
 * practicable chunks at all (e.g. a young library) falls back to the nearest level.
 */
export async function pickDailyChunk(tx: Tx, userId: string, level: CefrLevel): Promise<string> {
  for (const l of levelsByDistance(level)) {
    const id = await pickAtLevel(tx, userId, l);
    if (id) return id;
  }
  throw new Error("no practicable chunks in the library");
}

async function pickAtLevel(tx: Tx, userId: string, level: CefrLevel): Promise<string | null> {
  const [fresh] = await tx
    .select({ id: chunk.id })
    .from(chunk)
    .leftJoin(
      practiceSession,
      and(eq(practiceSession.chunkId, chunk.id), eq(practiceSession.userId, userId)),
    )
    .where(and(practicable(level), isNull(practiceSession.id)))
    .orderBy(sql`random()`)
    .limit(1);
  if (fresh) return fresh.id;

  const [recycled] = await tx
    .select({ id: chunk.id, last: max(practiceSession.startedAt) })
    .from(chunk)
    .innerJoin(
      practiceSession,
      and(eq(practiceSession.chunkId, chunk.id), eq(practiceSession.userId, userId)),
    )
    .where(practicable(level))
    .groupBy(chunk.id)
    .orderBy(max(practiceSession.startedAt))
    .limit(1);
  return recycled?.id ?? null;
}

export async function isPracticable(tx: Tx, chunkId: string) {
  const [row] = await tx
    .select({ id: chunk.id })
    .from(chunk)
    .where(
      and(
        eq(chunk.id, chunkId),
        eq(chunk.status, "active"),
        inArray(chunk.auditStatus, ["passed", "admin_approved"]),
      ),
    );
  return Boolean(row);
}
