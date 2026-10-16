import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { attempt, chunk, practiceSession } from "@/db/schema";
import { recordAttempt } from "@/lib/domain/attempts";
import { advanceStep, startDailySession } from "@/lib/domain/session-engine";
import { setTestEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { MemoryStorage, setStorage } from "@/lib/providers/storage";
import { createTestDb } from "../helpers/db";
import { createLearner, seedAll } from "../helpers/fixtures";
import { mockLlm } from "../helpers/llm";
import { scoringMock } from "../mocks/handlers";

let db: Db;
let close: () => Promise<void>;
const store = new MemoryStorage();
let llm: ReturnType<typeof mockLlm>;

beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  await seedAll(db);
  setStorage(store);
  llm = mockLlm([{ message: "Lovely! Keep your tongue soft between your teeth." }]);
});
afterAll(async () => {
  llm.restore();
  setStorage(undefined);
  await close();
});
afterEach(() => scoringMock.reset());

// A recognizable byte pattern so we can prove it never lands anywhere.
const MARKER = new Uint8Array(4096).map((_, i) => (i * 37 + 11) % 256);
const recording = () => new Blob([MARKER], { type: "audio/webm" });

async function readyLearner() {
  const u = await createLearner(db);
  const ctx = {
    userId: u.id,
    level: "B1" as const,
    timeZone: "UTC",
    now: new Date("2026-10-16T10:00:00Z"),
  };
  const s = await startDailySession(ctx);
  await advanceStep(ctx, s.id, "learn");
  return { ctx, s };
}

describe("recordAttempt (US1, FR-013, FR-019)", () => {
  it("scores a recording, stores only derived results, and returns fixed hints + tip", async () => {
    const { ctx, s } = await readyLearner();
    const out = await recordAttempt(
      ctx,
      s.id,
      { step: "speak_1", item: "chunk", mimeType: "audio/webm" },
      recording(),
    );
    expect(out).toMatchObject({ kind: "scored", score: 78, improvement: null });
    if (out.kind !== "scored") throw new Error();
    expect(out.weakestSounds.map((h) => h.ipa)).toEqual(["ð", "s"]);
    expect(out.weakestSounds[0]!.hint).toMatch(/tongue tip lightly between your teeth/i);
    expect(scoringMock.requests[0]!.audioBytes).toBe(4096);
    const [row] = await db.select().from(attempt).where(eq(attempt.sessionId, s.id));
    const [c] = await db.select().from(chunk).where(eq(chunk.id, s.chunkId));
    expect(row).toMatchObject({ score: 78, weakestSounds: ["ð", "s"], expectedText: c!.text });
  });

  it("never persists or logs the audio — success and failure (SC-008)", async () => {
    const { ctx, s } = await readyLearner();
    const logged: string[] = [];
    const spies = (["info", "warn", "error", "debug"] as const).map((lvl) =>
      vi
        .spyOn(logger, lvl)
        .mockImplementation(
          ((...args: unknown[]) => void logged.push(JSON.stringify(args))) as never,
        ),
    );
    await recordAttempt(
      ctx,
      s.id,
      { step: "speak_1", item: "example_1", mimeType: "audio/webm" },
      recording(),
    );
    scoringMock.mode = "down";
    await recordAttempt(
      ctx,
      s.id,
      { step: "speak_1", item: "example_2", mimeType: "audio/webm" },
      recording(),
    ).catch(() => undefined);
    spies.forEach((sp) => sp.mockRestore());

    // Storage: nothing besides (possibly) TTS objects — and certainly not our bytes.
    for (const obj of store.objects.values())
      expect(Buffer.from(obj.body).includes(Buffer.from(MARKER.slice(0, 64)))).toBe(false);
    // Database: no column anywhere holds the bytes.
    const dump = JSON.stringify(await db.select().from(attempt));
    expect(dump).not.toContain(Buffer.from(MARKER.slice(0, 64)).toString("base64"));
    // Logs: no bytes.
    expect(logged.join("\n")).not.toContain(Buffer.from(MARKER.slice(0, 64)).toString("hex"));
  });

  it("returns `unusable` without creating an attempt (not counted)", async () => {
    const { ctx, s } = await readyLearner();
    scoringMock.mode = "unusable";
    const out = await recordAttempt(
      ctx,
      s.id,
      { step: "speak_1", item: "chunk", mimeType: "audio/webm" },
      recording(),
    );
    expect(out).toEqual({ kind: "unusable", reason: "no_speech" });
    expect(await db.select().from(attempt).where(eq(attempt.sessionId, s.id))).toHaveLength(0);
  });

  it("on 503 keeps the session but stops it counting toward the limit until a success", async () => {
    const { ctx, s } = await readyLearner();
    scoringMock.mode = "down";
    await expect(
      recordAttempt(
        ctx,
        s.id,
        { step: "speak_1", item: "chunk", mimeType: "audio/webm" },
        recording(),
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    let [row] = await db.select().from(practiceSession).where(eq(practiceSession.id, s.id));
    expect(row).toMatchObject({ step: "speak_1", countsTowardLimit: false });
    scoringMock.mode = "ok";
    await recordAttempt(
      ctx,
      s.id,
      { step: "speak_1", item: "chunk", mimeType: "audio/webm" },
      recording(),
    );
    [row] = await db.select().from(practiceSession).where(eq(practiceSession.id, s.id));
    expect(row!.countsTowardLimit).toBe(true);
  });

  it("reports try-2 improvement over try 1 (FR-015)", async () => {
    const { ctx, s } = await readyLearner();
    for (const item of ["chunk", "example_1", "example_2", "example_3"] as const) {
      scoringMock.score = 60;
      await recordAttempt(
        ctx,
        s.id,
        { step: "speak_1", item, mimeType: "audio/webm" },
        recording(),
      );
    }
    await advanceStep(ctx, s.id, "speak_1");
    scoringMock.score = 82;
    const out = await recordAttempt(
      ctx,
      s.id,
      { step: "speak_2", item: "chunk", mimeType: "audio/mp4" },
      recording(),
    );
    expect(out).toMatchObject({ kind: "scored", score: 82, improvement: 22 });
  });

  it("rejects recordings for a step that isn't current, and oversized audio", async () => {
    const { ctx, s } = await readyLearner();
    await expect(
      recordAttempt(
        ctx,
        s.id,
        { step: "speak_2", item: "chunk", mimeType: "audio/webm" },
        recording(),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      recordAttempt(
        ctx,
        s.id,
        { step: "speak_1", item: "chunk", mimeType: "audio/webm" },
        new Blob([new Uint8Array(1_048_577)]),
      ),
    ).rejects.toMatchObject({ code: "validation" });
  });

  it("falls back to fixed hints with a plain message when the LLM is down", async () => {
    llm.restore();
    const down = mockLlm(["not json"]);
    const { ctx, s } = await readyLearner();
    const out = await recordAttempt(
      ctx,
      s.id,
      { step: "speak_1", item: "chunk", mimeType: "audio/webm" },
      recording(),
    );
    expect(out).toMatchObject({
      kind: "scored",
      tip: expect.stringMatching(/focus on the sounds/i),
    });
    down.restore();
    llm = mockLlm([{ message: "Lovely! Keep your tongue soft between your teeth." }]);
  });
});
