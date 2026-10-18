import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { adminAuditLog, chunk } from "@/db/schema";
import {
  approveChunk,
  listModeration,
  moderationStats,
  pendingModerationCount,
  setChunkStatus,
} from "@/lib/domain/admin-chunks";
import { setTestEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createTestDb } from "../helpers/db";
import { chunksAtLevel, createLearner, seedAll } from "../helpers/fixtures";

let db: Db;
let close: () => Promise<void>;
let adminId: string;
let flagged: string[];

beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  await seedAll(db);
  adminId = (await createLearner(db, { role: "admin" })).id;
  // Three chunks the auditor flagged (one with notes), the rest stay "passed".
  const c2 = await chunksAtLevel(db, "C2");
  flagged = c2.slice(0, 3).map((c) => c.id);
  for (const id of flagged)
    await db
      .update(chunk)
      .set({
        auditStatus: "failed",
        auditNotes: { verdict: "fail", issues: ["Level may be too high"], suggestedLevel: "C1" },
      })
      .where(eq(chunk.id, id));
});
afterAll(() => close());

describe("chunk moderation queue", () => {
  it("lists flagged chunks as pending, with examples and the auditor's notes", async () => {
    const { tab, rows } = await listModeration({});
    expect(tab).toBe("pending");
    expect(rows.map((r) => r.id).sort()).toEqual([...flagged].sort());
    expect(rows[0]!.examples).toHaveLength(3);
    expect(rows[0]!.auditNotes).toMatchObject({ suggestedLevel: "C1" });
    expect(await pendingModerationCount()).toBe(3);
  });

  it("approves a flagged chunk as-is: it leaves pending, appears in accepted, and is logged", async () => {
    await approveChunk(adminId, flagged[0]!);
    expect((await listModeration({})).rows.map((r) => r.id)).not.toContain(flagged[0]);
    expect((await listModeration({ tab: "accepted" })).rows.map((r) => r.id)).toContain(
      flagged[0],
    );
    const [row] = await db.select().from(chunk).where(eq(chunk.id, flagged[0]!));
    expect(row!.auditStatus).toBe("admin_approved");
    const logs = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.targetId, flagged[0]!));
    expect(logs.map((l) => l.action)).toContain("chunk.approve");
  });

  it("denies by retiring: the chunk moves to rejected", async () => {
    await setChunkStatus(adminId, flagged[1]!, "retired");
    expect((await listModeration({ tab: "rejected" })).rows.map((r) => r.id)).toEqual([
      flagged[1],
    ]);
    expect(await pendingModerationCount()).toBe(1);
  });

  it("only approves chunks that are actually waiting for review", async () => {
    const err = await approveChunk(adminId, flagged[0]!).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("conflict");
  });

  it("reports library size, reviews this week and the acceptance rate", async () => {
    const stats = await moderationStats();
    expect(stats.reviewedThisWeek).toBe(2); // one approve + one deny
    expect(stats.acceptanceRate).toBe(50);
    expect(stats.librarySize).toBeGreaterThan(0);
  });

  it("searches within a tab", async () => {
    const [c] = await db.select().from(chunk).where(eq(chunk.id, flagged[2]!));
    const { rows } = await listModeration({ tab: "pending", q: c!.text.slice(0, 5) });
    expect(rows.map((r) => r.id)).toContain(flagged[2]);
  });
});
