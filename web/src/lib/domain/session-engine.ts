import { and, asc, count, eq } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import {
  appSetting,
  attempt,
  chunk,
  chunkExample,
  practiceSession,
  subscription,
  user,
  writingResult,
  type CefrLevel,
  type SessionStep,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { isPracticable, pickDailyChunk } from "./chunk-picker";
import { computeDailyScore, mean, nextStreak } from "./daily-score";
import { getDailyLimit, reservePractice } from "./limits";
import { awardSession } from "./points";
import { practiceDateFor } from "./time";

export type SessionCtx = { userId: string; level: CefrLevel; timeZone: string; now?: Date };
export type PracticeSession = typeof practiceSession.$inferSelect;

const ORDER: SessionStep[] = ["learn", "speak_1", "speak_2", "write", "read_aloud", "done"];
const next = (s: SessionStep) => ORDER[ORDER.indexOf(s) + 1] ?? "done";
const SPEAK_ITEMS = 4; // chunk + 3 examples
const SENTENCES = 3;

async function limitFor(tx: Tx, userId: string) {
  // Sequential on purpose: a transaction is a single connection.
  const [setting] = await tx.select().from(appSetting).limit(1);
  const [sub] = await tx.select().from(subscription).where(eq(subscription.userId, userId));
  const [u] = await tx
    .select({ earlyTester: user.earlyTester, role: user.role })
    .from(user)
    .where(eq(user.id, userId));
  return getDailyLimit({
    billingActive: setting?.billingActive ?? false,
    subscription: sub ? { tier: sub.tier, status: sub.status } : null,
    earlyTester: u?.earlyTester ?? false,
    isAdmin: u?.role === "admin",
  });
}

async function reserve(tx: Tx, ctx: SessionCtx, practiceDate: string) {
  await reservePractice(tx, {
    userId: ctx.userId,
    limit: await limitFor(tx, ctx.userId),
    timeZone: ctx.timeZone,
    now: ctx.now,
    countUsed: async (t) => {
      const [row] = await t
        .select({ n: count() })
        .from(practiceSession)
        .where(
          and(
            eq(practiceSession.userId, ctx.userId),
            eq(practiceSession.practiceDate, practiceDate),
            eq(practiceSession.countsTowardLimit, true),
          ),
        );
      return row?.n ?? 0;
    },
  });
}

/** Today's daily session: resumes an existing one, otherwise reserves a practice and picks a chunk. */
export async function startDailySession(ctx: SessionCtx): Promise<PracticeSession> {
  const practiceDate = practiceDateFor(ctx.timeZone, ctx.now);
  return db().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(practiceSession)
      .where(
        and(
          eq(practiceSession.userId, ctx.userId),
          eq(practiceSession.practiceDate, practiceDate),
          eq(practiceSession.origin, "daily"),
        ),
      );
    if (existing) return existing;
    await reserve(tx, ctx, practiceDate);
    const chunkId = await pickDailyChunk(tx, ctx.userId, ctx.level);
    const [created] = await tx
      .insert(practiceSession)
      .values({
        userId: ctx.userId,
        chunkId,
        origin: "daily",
        practiceDate,
        startedAt: ctx.now ?? new Date(),
      })
      .returning();
    return created!;
  });
}

/** A practice for a chosen library chunk (FR-042); shares the daily limit. */
export async function startLibrarySession(
  ctx: SessionCtx,
  chunkId: string,
): Promise<PracticeSession> {
  const practiceDate = practiceDateFor(ctx.timeZone, ctx.now);
  return db().transaction(async (tx) => {
    if (!(await isPracticable(tx, chunkId)))
      throw new AppError("not_found", "That chunk isn't available.");
    await reserve(tx, ctx, practiceDate);
    const [created] = await tx
      .insert(practiceSession)
      .values({
        userId: ctx.userId,
        chunkId,
        origin: "library",
        practiceDate,
        startedAt: ctx.now ?? new Date(),
      })
      .returning();
    return created!;
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownSession(tx: Tx, ctx: SessionCtx, sessionId: string, lock = false) {
  if (!UUID.test(sessionId)) throw new AppError("not_found", "Session not found.");
  const q = tx
    .select()
    .from(practiceSession)
    .where(and(eq(practiceSession.id, sessionId), eq(practiceSession.userId, ctx.userId)));
  const [s] = lock ? await q.for("update") : await q;
  if (!s) throw new AppError("not_found", "Session not found.");
  return s;
}

export async function getSession(ctx: SessionCtx, sessionId: string) {
  const d = db();
  const s = await ownSession(d as unknown as Tx, ctx, sessionId);
  const [c] = await d.select().from(chunk).where(eq(chunk.id, s.chunkId));
  const [examples, attempts, writing] = await Promise.all([
    d
      .select()
      .from(chunkExample)
      .where(eq(chunkExample.chunkId, s.chunkId))
      .orderBy(asc(chunkExample.position)),
    d.select().from(attempt).where(eq(attempt.sessionId, s.id)),
    d
      .select()
      .from(writingResult)
      .where(eq(writingResult.sessionId, s.id))
      .orderBy(asc(writingResult.position)),
  ]);
  return { session: s, chunk: c!, examples, attempts, writing };
}

async function stepRequirementMet(tx: Tx, s: PracticeSession): Promise<boolean> {
  const countAttempts = async (step: SessionStep) => {
    const [r] = await tx
      .select({ n: count() })
      .from(attempt)
      .where(and(eq(attempt.sessionId, s.id), eq(attempt.step, step)));
    return r?.n ?? 0;
  };
  switch (s.step) {
    case "learn":
      return true;
    case "speak_1":
    case "speak_2":
      return (await countAttempts(s.step)) >= SPEAK_ITEMS;
    case "write": {
      const [r] = await tx
        .select({ n: count() })
        .from(writingResult)
        .where(eq(writingResult.sessionId, s.id));
      return (r?.n ?? 0) >= SENTENCES;
    }
    case "read_aloud":
      return (await countAttempts("read_aloud")) >= SENTENCES;
    case "done":
      return true;
  }
}

/** Forward-only, idempotent step transition (FR-021). */
export async function advanceStep(
  ctx: SessionCtx,
  sessionId: string,
  from: SessionStep,
): Promise<PracticeSession> {
  const moved = await db().transaction(async (tx) => {
    const s = await ownSession(tx, ctx, sessionId, true);
    if (ORDER.indexOf(s.step) > ORDER.indexOf(from)) return s; // already past: no-op
    if (s.step !== from) throw new AppError("conflict", "Finish the current step first.");
    if (!(await stepRequirementMet(tx, s)))
      throw new AppError("validation", "This step isn't finished yet.");
    if (from === "read_aloud") return null; // completion goes through completeSession
    const [u] = await tx
      .update(practiceSession)
      .set({ step: next(s.step) })
      .where(eq(practiceSession.id, s.id))
      .returning();
    return u!;
  });
  return moved ?? completeSession(ctx, sessionId);
}

/** No microphone: skip the current speaking step(s); the daily score becomes partial. */
export async function skipSpeaking(ctx: SessionCtx, sessionId: string): Promise<PracticeSession> {
  const s = await db().transaction(async (tx) => {
    const cur = await ownSession(tx, ctx, sessionId, true);
    if (cur.step === "speak_1" || cur.step === "speak_2") {
      const [u] = await tx
        .update(practiceSession)
        .set({ step: "write", partial: true })
        .where(eq(practiceSession.id, cur.id))
        .returning();
      return u!;
    }
    if (cur.step === "read_aloud") {
      await tx.update(practiceSession).set({ partial: true }).where(eq(practiceSession.id, cur.id));
      return null;
    }
    throw new AppError("conflict", "There is no speaking step to skip right now.");
  });
  return s ?? completeSession(ctx, sessionId, { allowIncomplete: true });
}

/** Computes and stores the daily score and streak (FR-018). Idempotent. */
export async function completeSession(
  ctx: SessionCtx,
  sessionId: string,
  opts: { allowIncomplete?: boolean } = {},
): Promise<PracticeSession> {
  return db().transaction(async (tx) => {
    const s = await ownSession(tx, ctx, sessionId, true);
    if (s.step === "done") return s;
    if (s.step !== "read_aloud") throw new AppError("conflict", "Finish the current step first.");
    if (!opts.allowIncomplete && !(await stepRequirementMet(tx, s))) {
      throw new AppError("validation", "Read all three sentences first.");
    }
    const attempts = await tx.select().from(attempt).where(eq(attempt.sessionId, s.id));
    const writing = await tx.select().from(writingResult).where(eq(writingResult.sessionId, s.id));
    const scoresFor = (step: SessionStep) =>
      attempts.filter((a) => a.step === step).map((a) => a.score);
    const speak1 = scoresFor("speak_1");
    const speak2 = scoresFor("speak_2");
    const read = scoresFor("read_aloud");
    const write = writing.map((w) => (w.usageGrade + w.grammarGrade) / 2);

    const [setting] = await tx.select().from(appSetting).limit(1);
    const weights = setting?.scoreWeights ?? { speaking: 40, writing: 30, read_aloud: 30 };
    const { score, partial } = computeDailyScore(
      {
        speaking: speak2.length ? mean(speak2) : null,
        writing: write.length ? mean(write) : null,
        readAloud: read.length ? mean(read) : null,
      },
      weights,
    );
    const round = (xs: number[]) => (xs.length ? Math.round(mean(xs)) : null);
    const [done] = await tx
      .update(practiceSession)
      .set({
        step: "done",
        status: "completed",
        speak1Score: round(speak1),
        speak2Score: round(speak2),
        writeScore: round(write),
        readAloudScore: round(read),
        dailyScore: score,
        partial: partial || s.partial,
        completedAt: ctx.now ?? new Date(),
      })
      .where(eq(practiceSession.id, s.id))
      .returning();

    const [u] = await tx.select().from(user).where(eq(user.id, ctx.userId)).for("update");
    const streak = nextStreak(
      {
        current: u!.currentStreak,
        longest: u!.longestStreak,
        lastPracticeDate: u!.lastPracticeDate,
      },
      s.practiceDate,
    );
    const lastPracticeDate =
      !u!.lastPracticeDate || u!.lastPracticeDate < s.practiceDate
        ? s.practiceDate
        : u!.lastPracticeDate;
    await tx
      .update(user)
      .set({ currentStreak: streak.current, longestStreak: streak.longest, lastPracticeDate })
      .where(eq(user.id, ctx.userId));

    await awardSession(tx, done!, streak.current);
    return done!;
  });
}

/** Scoring outage: don't let an unfinished practice consume the daily limit (spec assumption). */
export async function setCountsTowardLimit(sessionId: string, counts: boolean) {
  await db()
    .update(practiceSession)
    .set({ countsTowardLimit: counts })
    .where(eq(practiceSession.id, sessionId));
}

/** Read-only view of today for the /today page — never creates a session (safe to prefetch). */
export async function getTodayStatus(ctx: SessionCtx) {
  const practiceDate = practiceDateFor(ctx.timeZone, ctx.now);
  const d = db();
  const [existing] = await d
    .select({ id: practiceSession.id })
    .from(practiceSession)
    .where(
      and(
        eq(practiceSession.userId, ctx.userId),
        eq(practiceSession.practiceDate, practiceDate),
        eq(practiceSession.origin, "daily"),
      ),
    );
  const limit = await limitFor(d as unknown as Tx, ctx.userId);
  const [used] = await d
    .select({ n: count() })
    .from(practiceSession)
    .where(
      and(
        eq(practiceSession.userId, ctx.userId),
        eq(practiceSession.practiceDate, practiceDate),
        eq(practiceSession.countsTowardLimit, true),
      ),
    );
  return {
    existingSessionId: existing?.id ?? null,
    limit,
    remaining: Math.max(0, limit - (used?.n ?? 0)),
  };
}
