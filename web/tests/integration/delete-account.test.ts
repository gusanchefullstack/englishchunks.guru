import { eq } from "drizzle-orm";
import { http, HttpResponse } from "msw";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { chunk, practiceSession, subscription, user, writingResult } from "@/db/schema";
import { deleteAccount } from "@/lib/domain/account-deletion";
import { startDailySession } from "@/lib/domain/session-engine";
import { setTestEnv } from "@/lib/env";
import { MemoryStorage, setStorage } from "@/lib/providers/storage";
import { createTestDb } from "../helpers/db";
import { createLearner, seedAll } from "../helpers/fixtures";
import { server } from "../mocks/server";

let db: Db;
let close: () => Promise<void>;
const store = new MemoryStorage();
beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  await seedAll(db);
  setStorage(store);
});
afterAll(async () => {
  setStorage(undefined);
  await close();
});

describe("deleteAccount (FR-008)", () => {
  it("erases personal data, private audio, avatar; cancels Stripe; keeps accepted chunks unattributed", async () => {
    const u = await createLearner(db, { imageKey: "avatars/me.webp" });
    await store.put("avatars/me.webp", new Uint8Array([1]), {
      contentType: "image/webp",
      visibility: "public",
    });
    await store.put(`tts/u/${u.id}/a.mp3`, new Uint8Array([1]), {
      contentType: "audio/mpeg",
      visibility: "private",
    });
    await store.put("tts/shared/keep.mp3", new Uint8Array([1]), {
      contentType: "audio/mpeg",
      visibility: "public",
    });
    const s = await startDailySession({ userId: u.id, level: "B1", timeZone: "UTC" });
    await db.insert(writingResult).values({
      sessionId: s.id,
      position: 1,
      original: "my secret sentence",
      corrected: "x",
      usageGrade: 1,
      grammarGrade: 1,
      usesChunk: true,
      explanation: "x",
    });
    await db.insert(subscription).values({
      userId: u.id,
      tier: "standard",
      status: "active",
      stripeSubscriptionId: "sub_123",
    });
    const [c] = await db.select().from(chunk).limit(1);
    await db
      .update(chunk)
      .set({ submittedBy: u.id, source: "submitted" })
      .where(eq(chunk.id, c!.id));

    let cancelled = "";
    server.use(
      http.delete("https://api.stripe.com/v1/subscriptions/:id", ({ params }) => {
        cancelled = String(params.id);
        return HttpResponse.json({ id: params.id, status: "canceled" });
      }),
    );

    await deleteAccount(u.id);

    expect(cancelled).toBe("sub_123");
    expect(await db.select().from(user).where(eq(user.id, u.id))).toHaveLength(0);
    expect(
      await db.select().from(practiceSession).where(eq(practiceSession.userId, u.id)),
    ).toHaveLength(0);
    expect(JSON.stringify(await db.select().from(writingResult))).not.toContain(
      "my secret sentence",
    );
    expect(await db.select().from(subscription).where(eq(subscription.userId, u.id))).toHaveLength(
      0,
    );
    expect(store.objects.has("avatars/me.webp")).toBe(false);
    expect([...store.objects.keys()].some((k) => k.startsWith(`tts/u/${u.id}/`))).toBe(false);
    expect(store.objects.has("tts/shared/keep.mp3")).toBe(true);
    const [kept] = await db.select().from(chunk).where(eq(chunk.id, c!.id));
    expect(kept).toMatchObject({ submittedBy: null, status: "active" });
  });

  it("leaves the account intact if Stripe cancellation fails (retryable)", async () => {
    const u = await createLearner(db);
    await db.insert(subscription).values({
      userId: u.id,
      tier: "standard",
      status: "active",
      stripeSubscriptionId: "sub_fail",
    });
    server.use(
      http.delete(
        "https://api.stripe.com/v1/subscriptions/:id",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await expect(deleteAccount(u.id)).rejects.toMatchObject({ code: "unavailable" });
    expect(await db.select().from(user).where(eq(user.id, u.id))).toHaveLength(1);
  });
});
