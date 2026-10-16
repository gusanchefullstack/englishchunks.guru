import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { chunk, practiceSession, type CefrLevel } from "@/db/schema";

const practicable = (level: CefrLevel) =>
  and(
    eq(chunk.level, level),
    eq(chunk.status, "active"),
    inArray(chunk.auditStatus, ["passed", "admin_approved"]),
  );

/**
 * Daily chunk (FR-010): a practicable chunk at the learner's level they have never practiced;
 * when none is left, the least-recently practiced one (spec edge case).
 */
export async function pickDailyChunk(tx: Tx, userId: string, level: CefrLevel): Promise<string> {
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
  if (recycled) return recycled.id;
  throw new Error(`no practicable chunks at level ${level}`);
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
