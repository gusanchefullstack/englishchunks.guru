import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import {
  adminAuditLog,
  chunk,
  chunkExample,
  chunkSubmission,
  notification,
  user,
} from "@/db/schema";
import { searchChunks } from "@/lib/domain/library";
import { decideSubmission } from "@/lib/domain/submission-review";
import { checkDuplicate, submitChunk } from "@/lib/domain/submissions";
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

const accepted = {
  text: "break the ice",
  type: "idiom" as const,
  level: "B1" as const,
  registers: ["casual" as const],
  meaning: "Start a conversation in a relaxed way.",
  usageNote: "Use it when people feel shy at the start of a meeting or party.",
  examples: [
    { text: "He told a joke to break the ice.", register: "casual" as const },
    { text: "Let's break the ice with quick introductions.", register: "professional" as const },
    { text: "Games help kids break the ice.", register: "casual" as const },
  ],
};

describe("chunk submissions (US5)", () => {
  it("blocks an exact duplicate and points to the existing chunk", async () => {
    const u = await createLearner(db);
    expect((await checkDuplicate("Spilled the beans!")).exact?.text).toBe("spill the beans");
    await expect(
      submitChunk({ id: u.id, timeZone: "UTC" }, { text: "spill the beans" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("requires acknowledging similar chunks before submitting", async () => {
    const u = await createLearner(db);
    await expect(
      submitChunk({ id: u.id, timeZone: "UTC" }, { text: "in the grand scheme" }),
    ).rejects.toMatchObject({ code: "validation" });
    const row = await submitChunk(
      { id: u.id, timeZone: "UTC" },
      { text: "in the grand scheme", acknowledgeSimilar: true },
    );
    expect(row.status).toBe("pending");
    expect(row.matchedChunkIds.length).toBeGreaterThan(0);
  });

  it("queues a new chunk as pending and merges a second learner's duplicate into it", async () => {
    const first = await createLearner(db);
    const second = await createLearner(db);
    const a = await submitChunk(
      { id: first.id, timeZone: "UTC" },
      { text: "Break the ice", meaning: "start talking" },
    );
    const b = await submitChunk({ id: second.id, timeZone: "UTC" }, { text: "breaking the ice" });
    expect(a.status).toBe("pending");
    expect(b).toMatchObject({ status: "merged", mergedInto: a.id });

    // Admin accepts: chunk published with espeak IPA (phonemize mock), learner notified + 20 points.
    const admin = await createLearner(db, { role: "admin" });
    const { chunkId } = await decideSubmission(admin.id, {
      submissionId: a.id,
      decision: "accept",
      chunk: accepted,
    });
    const [c] = await db.select().from(chunk).where(eq(chunk.id, chunkId!));
    expect(c).toMatchObject({
      source: "submitted",
      submittedBy: first.id,
      auditStatus: "admin_approved",
      ipa: "/break the ice/",
    });
    expect(
      await db.select().from(chunkExample).where(eq(chunkExample.chunkId, chunkId!)),
    ).toHaveLength(3);
    expect((await searchChunks({ q: "break the ice" })).items.map((i) => i.text)).toContain(
      "break the ice",
    );

    const [u] = await db.select().from(user).where(eq(user.id, first.id));
    expect(u!.totalPoints).toBe(20);
    const notes = await db.select().from(notification).where(eq(notification.userId, first.id));
    expect(notes.map((n) => n.type)).toContain("submission_accepted");
    expect(mail.sent.some((m) => m.to === first.email && /in the library/i.test(m.subject))).toBe(
      true,
    );
    const [second2] = await db.select().from(user).where(eq(user.id, second.id));
    expect(second2!.totalPoints).toBe(0); // merged duplicates don't earn points
    expect(
      await db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, a.id)),
    ).toHaveLength(1);

    await expect(
      decideSubmission(admin.id, { submissionId: a.id, decision: "reject" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects with an optional reason and no points", async () => {
    const u = await createLearner(db);
    const admin = await createLearner(db, { role: "admin" });
    const s = await submitChunk({ id: u.id, timeZone: "UTC" }, { text: "under the weather" });
    await decideSubmission(admin.id, {
      submissionId: s.id,
      decision: "reject",
      reason: "Already planned for next month.",
    });
    const [row] = await db.select().from(chunkSubmission).where(eq(chunkSubmission.id, s.id));
    expect(row).toMatchObject({
      status: "rejected",
      decisionReason: "Already planned for next month.",
    });
    const notes = await db.select().from(notification).where(eq(notification.userId, u.id));
    expect(notes[0]!.message).toMatch(/Already planned/);
    const [after] = await db.select().from(user).where(eq(user.id, u.id));
    expect(after!.totalPoints).toBe(0);
  });

  it("requires a complete chunk record to accept (3 examples)", async () => {
    const u = await createLearner(db);
    const admin = await createLearner(db, { role: "admin" });
    const s = await submitChunk({ id: u.id, timeZone: "UTC" }, { text: "call it a day" });
    await expect(
      decideSubmission(admin.id, {
        submissionId: s.id,
        decision: "accept",
        chunk: { ...accepted, text: "call it a day", examples: accepted.examples.slice(0, 2) },
      }),
    ).rejects.toThrow();
  });

  it("caps suggestions at 5 per learner per day", async () => {
    const u = await createLearner(db);
    for (const t of [
      "piece of cake",
      "hit the sack",
      "on the fence",
      "cut corners",
      "the last straw",
    ]) {
      await submitChunk({ id: u.id, timeZone: "UTC" }, { text: t });
    }
    await expect(
      submitChunk({ id: u.id, timeZone: "UTC" }, { text: "once in a blue moon" }),
    ).rejects.toMatchObject({ code: "limit_reached" });
  });
});
