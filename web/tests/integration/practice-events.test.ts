import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { practiceEvent, user } from "@/db/schema";
import { recordAttempt } from "@/lib/domain/attempts";
import {
  CLIENT_EVENTS_PER_DAY,
  ClientEventInput,
  prunePracticeEvents,
  recordClientEvent,
} from "@/lib/domain/practice-events";
import { advanceStep, startDailySession } from "@/lib/domain/session-engine";
import { setTestEnv } from "@/lib/env";
import { createTestDb } from "../helpers/db";
import { createLearner, seedAll } from "../helpers/fixtures";
import { mockLlm } from "../helpers/llm";
import { scoringMock } from "../mocks/handlers";

let db: Db;
let close: () => Promise<void>;
let llm: ReturnType<typeof mockLlm>;

beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  await seedAll(db);
  llm = mockLlm([{ message: "Lovely!" }]);
});
afterAll(async () => {
  llm.restore();
  await close();
});
afterEach(() => scoringMock.reset());

const recording = () => new Blob([new Uint8Array(2048)], { type: "audio/webm" });
const speak = { step: "speak_1", item: "chunk", mimeType: "audio/webm" } as const;

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
  return { u, ctx, s };
}

const eventsOf = (userId: string) =>
  db.select().from(practiceEvent).where(eq(practiceEvent.userId, userId));

describe("practice diagnostics (FR-074)", () => {
  it("logs an unusable recording with its reason and step", async () => {
    const { u, ctx, s } = await readyLearner();
    scoringMock.mode = "unusable";
    await recordAttempt(ctx, s.id, speak, recording());
    expect(await eventsOf(u.id)).toEqual([
      expect.objectContaining({
        sessionId: s.id,
        kind: "recording_unusable",
        step: "speak_1",
        reason: "no_speech",
      }),
    ]);
  });

  it("logs a scoring outage and nothing for a scored recording", async () => {
    const { u, ctx, s } = await readyLearner();
    scoringMock.mode = "down";
    await expect(recordAttempt(ctx, s.id, speak, recording())).rejects.toMatchObject({
      code: "unavailable",
    });
    scoringMock.mode = "ok";
    await recordAttempt(ctx, s.id, speak, recording());
    const rows = await eventsOf(u.id);
    expect(rows.map((r) => r.kind)).toEqual(["scoring_unavailable"]);
  });

  it("stores a browser report for the learner's own session", async () => {
    const { u, s } = await readyLearner();
    await recordClientEvent(u.id, {
      kind: "mic_denied",
      sessionId: s.id,
      step: "speak_1",
      reason: "NotAllowedError",
    });
    expect(await eventsOf(u.id)).toEqual([
      expect.objectContaining({ kind: "mic_denied", reason: "NotAllowedError", step: "speak_1" }),
    ]);
  });

  it("refuses a report about someone else's session", async () => {
    const { s } = await readyLearner();
    const other = await createLearner(db);
    await expect(
      recordClientEvent(other.id, { kind: "mic_unsupported", sessionId: s.id }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await eventsOf(other.id)).toHaveLength(0);
  });

  it("caps browser reports per learner per day", async () => {
    const { u } = await readyLearner();
    const now = new Date("2026-10-16T12:00:00Z");
    for (let i = 0; i < CLIENT_EVENTS_PER_DAY; i++)
      await recordClientEvent(u.id, { kind: "page_error", reason: "client" }, now);
    await expect(
      recordClientEvent(u.id, { kind: "page_error", reason: "client" }, now),
    ).rejects.toMatchObject({ code: "limit_reached" });
    expect(await eventsOf(u.id)).toHaveLength(CLIENT_EVENTS_PER_DAY);
  });

  it("accepts only allow-listed codes from the browser", () => {
    const sessionId = "01a14f55-be52-7dae-9bb3-fda7edf7e133";
    const ok = (v: unknown) => ClientEventInput.safeParse(v).success;
    expect(ok({ kind: "upload_failed", sessionId, reason: "http_503" })).toBe(true);
    expect(ok({ kind: "upload_failed", sessionId, reason: "offline" })).toBe(true);
    expect(ok({ kind: "page_error", reason: "1234567890" })).toBe(true);
    // Free text, server-only kinds and unknown mic errors are rejected.
    expect(ok({ kind: "page_error", reason: "token=abc secret" })).toBe(false);
    expect(ok({ kind: "upload_failed", sessionId, reason: "oops" })).toBe(false);
    expect(ok({ kind: "recording_unusable", sessionId, reason: "no_speech" })).toBe(false);
    expect(ok({ kind: "mic_denied", sessionId, reason: "TypeError" })).toBe(false);
  });

  it("prunes events older than 30 days and keeps recent ones", async () => {
    const { u } = await readyLearner();
    const now = new Date("2026-10-18T00:00:00Z");
    await db.insert(practiceEvent).values([
      {
        userId: u.id,
        kind: "page_error",
        reason: "old",
        createdAt: new Date("2026-09-17T00:00:00Z"),
      },
      {
        userId: u.id,
        kind: "page_error",
        reason: "new",
        createdAt: new Date("2026-09-19T00:00:00Z"),
      },
    ]);
    expect(await prunePracticeEvents(now)).toBeGreaterThanOrEqual(1);
    expect((await eventsOf(u.id)).map((r) => r.reason)).toEqual(["new"]);
  });

  it("deletes a learner's events with their account", async () => {
    const { u, s } = await readyLearner();
    await recordClientEvent(u.id, { kind: "mic_unsupported", sessionId: s.id });
    await db.delete(user).where(eq(user.id, u.id));
    expect(await eventsOf(u.id)).toHaveLength(0);
  });
});
