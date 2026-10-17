import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { searchChunks } from "@/lib/domain/library";
import { startDailySession, startLibrarySession } from "@/lib/domain/session-engine";
import { createTestDb } from "../helpers/db";
import { createLearner, seedAll } from "../helpers/fixtures";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedAll(db);
});
afterAll(() => close());

const now = new Date("2026-10-16T10:00:00Z");

describe("library practice (FR-042)", () => {
  it("starts a library session and then shares the Basic limit with the daily session", async () => {
    const u = await createLearner(db, { timeZone: "Asia/Tokyo" });
    const ctx = { userId: u.id, level: "B1" as const, timeZone: "Asia/Tokyo", now };
    const [target] = (await searchChunks({ q: "get used to" })).items;
    const s = await startLibrarySession(ctx, target!.id);
    expect(s).toMatchObject({ origin: "library", chunkId: target!.id, step: "learn" });

    const err = await startDailySession(ctx).catch((e: unknown) => e);
    // Tokyo is UTC+9 → next local midnight is 2026-10-16T15:00Z
    expect(err).toMatchObject({
      code: "limit_reached",
      details: { resetsAt: "2026-10-16T15:00:00.000Z", limit: 1 },
    });
  });

  it("rejects unknown or retired chunks", async () => {
    const u = await createLearner(db);
    const ctx = { userId: u.id, level: "B1" as const, timeZone: "UTC", now };
    await expect(
      startLibrarySession(ctx, "0199f0a2-0000-7000-8000-000000000000"),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
