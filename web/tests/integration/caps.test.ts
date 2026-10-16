import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { practiceSession } from "@/db/schema";
import { recordAttempt } from "@/lib/domain/attempts";
import { CAPS, consume } from "@/lib/domain/caps";
import {
  advanceStep,
  getSession,
  getTodayStatus,
  startDailySession,
} from "@/lib/domain/session-engine";
import { submitWriting } from "@/lib/domain/writing";
import { setTestEnv } from "@/lib/env";
import { createTestDb } from "../helpers/db";
import { createLearner, seedAll } from "../helpers/fixtures";
import { mockLlm } from "../helpers/llm";

let db: Db;
let close: () => Promise<void>;
let llm: ReturnType<typeof mockLlm>;
beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  await seedAll(db);
  llm = mockLlm([
    {
      message: "Nice!",
      usesChunk: true,
      usageGrade: 90,
      grammarGrade: 90,
      corrected: "ok",
      explanation: "Good.",
      flags: [],
    },
  ]);
});
afterAll(async () => {
  llm.restore();
  await close();
});

const now = new Date("2026-10-16T10:00:00Z");

describe("cost caps (constitution V)", () => {
  it("counts atomically and throws once the cap is exceeded", async () => {
    await consume("t:1", 2, "stop");
    await consume("t:1", 2, "stop");
    await expect(consume("t:1", 2, "stop")).rejects.toMatchObject({ code: "limit_reached" });
  });

  it(`caps scoring calls per session at ${CAPS.scoringPerSession}`, async () => {
    const u = await createLearner(db);
    const ctx = { userId: u.id, level: "B1" as const, timeZone: "UTC", now };
    const s = await startDailySession(ctx);
    await advanceStep(ctx, s.id, "learn");
    const blob = () => new Blob([new Uint8Array(512)], { type: "audio/webm" });
    for (let i = 0; i < CAPS.scoringPerSession; i++) {
      await recordAttempt(
        ctx,
        s.id,
        { step: "speak_1", item: "chunk", mimeType: "audio/webm" },
        blob(),
      );
    }
    await expect(
      recordAttempt(ctx, s.id, { step: "speak_1", item: "chunk", mimeType: "audio/webm" }, blob()),
    ).rejects.toMatchObject({ code: "limit_reached" });
  });

  it(`caps writing checks per session at ${CAPS.writingChecksPerSession}`, async () => {
    const u = await createLearner(db);
    const ctx = { userId: u.id, level: "B1" as const, timeZone: "UTC", now };
    const s = await startDailySession(ctx);
    await db.update(practiceSession).set({ step: "write" }).where(eq(practiceSession.id, s.id));
    for (let i = 0; i < CAPS.writingChecksPerSession; i++)
      await submitWriting(ctx, s.id, ["a b", "c d", "e f"]);
    await expect(submitWriting(ctx, s.id, ["a b", "c d", "e f"])).rejects.toMatchObject({
      code: "limit_reached",
    });
  });
});

describe("safe reads", () => {
  it("returns not_found (not a DB error) for malformed session ids", async () => {
    const u = await createLearner(db);
    await expect(
      getSession({ userId: u.id, level: "B1", timeZone: "UTC" }, "not-a-uuid"),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("getTodayStatus never creates a session (safe to prefetch /today)", async () => {
    const u = await createLearner(db);
    const ctx = { userId: u.id, level: "B1" as const, timeZone: "UTC", now };
    const before = await db.select().from(practiceSession).where(eq(practiceSession.userId, u.id));
    expect(await getTodayStatus(ctx)).toEqual({ existingSessionId: null, limit: 1, remaining: 1 });
    expect(await getTodayStatus(ctx)).toEqual({ existingSessionId: null, limit: 1, remaining: 1 });
    expect(await db.select().from(practiceSession).where(eq(practiceSession.userId, u.id))).toEqual(
      before,
    );
    const s = await startDailySession(ctx);
    expect(await getTodayStatus(ctx)).toEqual({ existingSessionId: s.id, limit: 1, remaining: 0 });
  });
});
