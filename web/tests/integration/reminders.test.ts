import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { chunk, notification, practiceSession, user } from "@/db/schema";
import { sendDueReminders } from "@/lib/domain/reminders";
import {
  unsubscribeReminders,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/domain/unsubscribe";
import { setTestEnv } from "@/lib/env";
import { createTestDb } from "../helpers/db";
import { captureEmails } from "../helpers/email";
import { createLearner, seedAll } from "../helpers/fixtures";

let db: Db;
let close: () => Promise<void>;
const mail = captureEmails();
beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  await seedAll(db);
});
afterAll(async () => {
  mail.restore();
  await close();
});
beforeEach(() => void (mail.sent.length = 0));

// 19:00 in Madrid (UTC+2 in October) = 17:00Z
const at1900Madrid = new Date("2026-10-16T17:00:00Z");

describe("daily reminders (FR-033)", () => {
  it("sends one reminder at the learner's local hour, with one-click unsubscribe headers", async () => {
    const u = await createLearner(db, {
      timeZone: "Europe/Madrid",
      reminderHour: 19,
      currentStreak: 4,
      longestStreak: 4,
      lastPracticeDate: "2026-10-15",
    });
    await createLearner(db, { timeZone: "Europe/Madrid", reminderHour: 8 }); // not due
    const r = await sendDueReminders(at1900Madrid);
    const mine = mail.sent.filter((m) => m.to === u.email);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.text).toMatch(/4-day streak/);
    expect(mine[0]!.headers).toMatchObject({
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(r.sent).toBeGreaterThanOrEqual(1);

    await sendDueReminders(at1900Madrid); // second run the same hour/day
    expect(mail.sent.filter((m) => m.to === u.email)).toHaveLength(1);
  });

  it("skips learners who already practiced today", async () => {
    const u = await createLearner(db, { timeZone: "Europe/Madrid", reminderHour: 19 });
    const [c] = await db.select().from(chunk).limit(1);
    await db
      .insert(practiceSession)
      .values({
        userId: u.id,
        chunkId: c!.id,
        origin: "daily",
        practiceDate: "2026-10-16",
        step: "done",
        status: "completed",
        dailyScore: 80,
      });
    await sendDueReminders(at1900Madrid);
    expect(mail.sent.filter((m) => m.to === u.email)).toHaveLength(0);
  });

  it("skips learners with reminders off", async () => {
    const u = await createLearner(db, {
      timeZone: "Europe/Madrid",
      reminderHour: 19,
      remindersEnabled: false,
    });
    await sendDueReminders(at1900Madrid);
    expect(mail.sent.filter((m) => m.to === u.email)).toHaveLength(0);
  });

  it("releases the daily claim if sending fails, so a later run can retry", async () => {
    const u = await createLearner(db, { timeZone: "Europe/Madrid", reminderHour: 19 });
    const { setEmailProvider } = await import("@/lib/providers/email");
    setEmailProvider({ send: async () => Promise.reject(new Error("down")) });
    await sendDueReminders(at1900Madrid);
    expect(await db.select().from(notification).where(eq(notification.userId, u.id))).toHaveLength(
      0,
    );
    captureEmails(); // restore capture for later tests
  });

  it("unsubscribes with a signed token, without signing in", async () => {
    const u = await createLearner(db);
    const token = unsubscribeToken(u.id);
    expect(verifyUnsubscribeToken(token)).toBe(u.id);
    expect(verifyUnsubscribeToken(`${token}x`)).toBeNull();
    expect(verifyUnsubscribeToken("forged.token")).toBeNull();
    expect(await unsubscribeReminders(token)).toBe(true);
    const [row] = await db.select().from(user).where(eq(user.id, u.id));
    expect(row!.remindersEnabled).toBe(false);
  });
});
