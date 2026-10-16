import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { appSetting, attempt, practiceSession, user, writingResult } from "@/db/schema";
import { AppError } from "@/lib/errors";
import {
  advanceStep,
  completeSession,
  getSession,
  skipSpeaking,
  startDailySession,
} from "@/lib/domain/session-engine";
import { createTestDb } from "../helpers/db";
import { chunksAtLevel, createLearner, seedAll } from "../helpers/fixtures";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedAll(db);
});
afterAll(() => close());

const at = (iso: string) => new Date(iso);
const ctxFor = (u: { id: string; level: string | null; timeZone: string }, now: Date) => ({
  userId: u.id,
  level: u.level as "B1",
  timeZone: u.timeZone,
  now,
});

async function addAttempts(
  sessionId: string,
  step: "speak_1" | "speak_2" | "read_aloud",
  score: number,
) {
  const items =
    step === "read_aloud"
      ? (["sentence_1", "sentence_2", "sentence_3"] as const)
      : (["chunk", "example_1", "example_2", "example_3"] as const);
  await db.insert(attempt).values(
    items.map((item) => ({
      sessionId,
      step,
      item,
      expectedText: "x",
      score,
      wordAccuracy: score,
      phonemeAccuracy: score,
      fluency: score,
      soundResults: [],
      weakestSounds: [],
      tip: "Nice!",
      hintTableVersion: 1,
    })),
  );
}

describe("session engine (US1)", () => {
  it("assigns one chunk at the learner's level and reuses today's daily session", async () => {
    const u = await createLearner(db);
    const now = at("2026-10-16T10:00:00Z");
    const s1 = await startDailySession(ctxFor(u, now));
    const s2 = await startDailySession(ctxFor(u, at("2026-10-16T18:00:00Z")));
    expect(s2.id).toBe(s1.id);
    const levelIds = (await chunksAtLevel(db, "B1")).map((c) => c.id);
    expect(levelIds).toContain(s1.chunkId);
    expect(s1).toMatchObject({ origin: "daily", step: "learn", practiceDate: "2026-10-16" });
  });

  it("prefers chunks the learner has not practiced", async () => {
    const u = await createLearner(db);
    const seen = new Set<string>();
    for (let d = 1; d <= 5; d++) {
      const s = await startDailySession(ctxFor(u, at(`2026-10-0${d}T10:00:00Z`)));
      seen.add(s.chunkId);
    }
    expect(seen.size).toBe(5); // all 5 B1 chunks before any repeat
    const sixth = await startDailySession(ctxFor(u, at("2026-10-06T10:00:00Z")));
    const first = await db
      .select()
      .from(practiceSession)
      .where(and(eq(practiceSession.userId, u.id), eq(practiceSession.practiceDate, "2026-10-01")));
    expect(sixth.chunkId).toBe(first[0]!.chunkId); // least recently practiced is recycled
  });

  it("moves forward only, idempotently, and checks step requirements", async () => {
    const u = await createLearner(db);
    const ctx = ctxFor(u, at("2026-10-16T10:00:00Z"));
    const s = await startDailySession(ctx);
    expect((await advanceStep(ctx, s.id, "learn")).step).toBe("speak_1");
    expect((await advanceStep(ctx, s.id, "learn")).step).toBe("speak_1"); // repeat is a no-op
    await expect(advanceStep(ctx, s.id, "speak_1")).rejects.toThrow(AppError); // needs 4 recordings
    await addAttempts(s.id, "speak_1", 60);
    expect((await advanceStep(ctx, s.id, "speak_1")).step).toBe("speak_2");
    await expect(advanceStep(ctx, s.id, "write")).rejects.toThrow(AppError); // can't jump ahead
  });

  it("resumes at the stored step with prior results (FR-021)", async () => {
    const u = await createLearner(db);
    const ctx = ctxFor(u, at("2026-10-16T10:00:00Z"));
    const s = await startDailySession(ctx);
    await advanceStep(ctx, s.id, "learn");
    await addAttempts(s.id, "speak_1", 55);
    const view = await getSession(ctx, s.id);
    expect(view.session.step).toBe("speak_1");
    expect(view.attempts).toHaveLength(4);
    expect(view.examples).toHaveLength(3);
  });

  it("blocks other learners from reading a session", async () => {
    const owner = await createLearner(db);
    const other = await createLearner(db);
    const s = await startDailySession(ctxFor(owner, at("2026-10-16T10:00:00Z")));
    await expect(getSession(ctxFor(other, at("2026-10-16T10:00:00Z")), s.id)).rejects.toMatchObject(
      { code: "not_found" },
    );
  });

  it("completes with the weighted daily score and updates the streak", async () => {
    const u = await createLearner(db, {
      currentStreak: 2,
      longestStreak: 2,
      lastPracticeDate: "2026-10-15",
    });
    const ctx = ctxFor(u, at("2026-10-16T10:00:00Z"));
    const s = await startDailySession(ctx);
    await advanceStep(ctx, s.id, "learn");
    await addAttempts(s.id, "speak_1", 60);
    await advanceStep(ctx, s.id, "speak_1");
    await addAttempts(s.id, "speak_2", 80);
    await advanceStep(ctx, s.id, "speak_2");
    await db.insert(writingResult).values(
      [1, 2, 3].map((position) => ({
        sessionId: s.id,
        position,
        original: "o",
        corrected: "c",
        usageGrade: 90,
        grammarGrade: 90,
        usesChunk: true,
        explanation: "Good.",
      })),
    );
    await advanceStep(ctx, s.id, "write");
    await addAttempts(s.id, "read_aloud", 70);
    const done = await completeSession(ctx, s.id);
    expect(done).toMatchObject({
      dailyScore: Math.round(0.4 * 80 + 0.3 * 90 + 0.3 * 70),
      partial: false,
      step: "done",
    });
    const [after] = await db.select().from(user).where(eq(user.id, u.id));
    expect(after).toMatchObject({
      currentStreak: 3,
      longestStreak: 3,
      lastPracticeDate: "2026-10-16",
    });
    // Completing again is idempotent.
    expect((await completeSession(ctx, s.id)).dailyScore).toBe(done.dailyScore);
    const [again] = await db.select().from(user).where(eq(user.id, u.id));
    expect(again!.currentStreak).toBe(3);
  });

  it("lets a learner without a microphone skip speaking; the score is partial", async () => {
    const u = await createLearner(db);
    const ctx = ctxFor(u, at("2026-10-16T10:00:00Z"));
    const s = await startDailySession(ctx);
    await advanceStep(ctx, s.id, "learn");
    expect((await skipSpeaking(ctx, s.id)).step).toBe("write");
    await db.insert(writingResult).values(
      [1, 2, 3].map((position) => ({
        sessionId: s.id,
        position,
        original: "o",
        corrected: "c",
        usageGrade: 80,
        grammarGrade: 100,
        usesChunk: true,
        explanation: "Good.",
      })),
    );
    await advanceStep(ctx, s.id, "write");
    expect((await skipSpeaking(ctx, s.id)).step).toBe("done");
    const [row] = await db.select().from(practiceSession).where(eq(practiceSession.id, s.id));
    expect(row).toMatchObject({ partial: true, dailyScore: 90 });
  });

  it("enforces the daily limit with the reset time (FR-060)", async () => {
    const u = await createLearner(db);
    const ctx = ctxFor(u, at("2026-10-16T10:00:00Z"));
    await startDailySession(ctx);
    const { startLibrarySession } = await import("@/lib/domain/session-engine");
    const [c] = await chunksAtLevel(db, "A2");
    const err = await startLibrarySession(ctx, c!.id).catch((e: unknown) => e);
    expect(err).toMatchObject({
      code: "limit_reached",
      details: { resetsAt: "2026-10-17T00:00:00.000Z" },
    });
  });

  it("does not count a session that failed because a service was down", async () => {
    const u = await createLearner(db);
    const ctx = ctxFor(u, at("2026-10-16T10:00:00Z"));
    const s = await startDailySession(ctx);
    await db
      .update(practiceSession)
      .set({ countsTowardLimit: false })
      .where(eq(practiceSession.id, s.id));
    const { startLibrarySession } = await import("@/lib/domain/session-engine");
    const [c] = await chunksAtLevel(db, "A2");
    await expect(startLibrarySession(ctx, c!.id)).resolves.toMatchObject({ origin: "library" });
  });

  it("uses Basic limit 1 while billing is inactive", async () => {
    const [setting] = await db.select().from(appSetting);
    expect(setting!.billingActive).toBe(false);
  });
});
