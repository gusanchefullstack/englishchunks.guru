import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { appSetting, chunk, chunkExample, user } from "@/db/schema";
import { createTestDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

const baseUser = { id: "u1", name: "Amira", email: "amira@example.com", username: "amira_m" };

describe("schema constraints (data-model.md)", () => {
  it("applies migrations with pg_trgm available", async () => {
    const res = await db.execute(sql`select similarity('make a decision', 'make decisions') as s`);
    expect(Number((res as unknown as { rows: { s: number }[] }).rows[0]!.s)).toBeGreaterThan(0.3);
  });

  it("enforces username format and display-name length", async () => {
    await expect(db.insert(user).values({ ...baseUser, username: "Bad Name" })).rejects.toThrow();
    await expect(db.insert(user).values({ ...baseUser, name: "x".repeat(41) })).rejects.toThrow();
    await db.insert(user).values(baseUser);
  });

  it("enforces longest_streak >= current_streak and reminder hour 0–23", async () => {
    await expect(
      db.insert(user).values({
        ...baseUser,
        id: "u2",
        email: "b@x.dev",
        username: "bee",
        currentStreak: 3,
        longestStreak: 2,
      }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(user)
        .values({ ...baseUser, id: "u3", email: "c@x.dev", username: "cee", reminderHour: 24 }),
    ).rejects.toThrow();
  });

  it("allows only one app_setting row with sane defaults", async () => {
    await db.insert(appSetting).values({});
    const [row] = await db.select().from(appSetting);
    expect(row).toMatchObject({ billingActive: false, accountCap: 200 });
    expect(row!.scoreWeights).toEqual({ speaking: 40, writing: 30, read_aloud: 30 });
    await expect(db.insert(appSetting).values({ id: 2 })).rejects.toThrow();
  });

  it("keeps active chunks unique by normalized text and examples at positions 1–3", async () => {
    const values = {
      text: "make a decision",
      normalizedText: "make a decision",
      type: "collocation" as const,
      level: "A2" as const,
      registers: ["casual" as const],
      meaning: "choose what to do",
      usageNote: "after thinking about options",
      ipa: "meɪk ə dɪsɪʒən",
    };
    const [c] = await db.insert(chunk).values(values).returning();
    await expect(db.insert(chunk).values(values)).rejects.toThrow();
    await db.insert(chunk).values({ ...values, status: "retired" });
    await expect(
      db
        .insert(chunkExample)
        .values({ chunkId: c!.id, position: 4, text: "x", register: "casual", ipa: "x" }),
    ).rejects.toThrow();
  });
});
