import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { adminAuditLog, session, subscription, user } from "@/db/schema";
import { auth, resetAuth } from "@/lib/auth";
import { exampleContainsChunk, upsertChunk } from "@/lib/domain/admin-chunks";
import { createUser, listUsers, setSuspended, updateUser } from "@/lib/domain/admin-users";
import { setTestEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type * as AuthzModule from "@/lib/authz";
import { createTestDb } from "../helpers/db";
import { captureEmails } from "../helpers/email";
import { createLearner, seedAll } from "../helpers/fixtures";

vi.mock("@/lib/authz", async (orig) => ({
  ...(await orig<typeof AuthzModule>()),
  requireAdmin: vi.fn(async () => {
    throw new AppError("forbidden", "Admins only.");
  }),
}));

let db: Db;
let close: () => Promise<void>;
const mail = captureEmails();
beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  await seedAll(db);
  resetAuth();
});
afterAll(async () => {
  mail.restore();
  await close();
});

describe("admin authorization (FR-050)", () => {
  it("every admin server action rejects non-admins", async () => {
    const actions = await import("@/server/actions/admin");
    const calls = [
      actions.adminCreateUser({}),
      actions.adminUpdateUser("x", {}),
      actions.adminSuspendUser("x", true),
      actions.adminDeleteUser("x", "DELETE"),
      actions.adminUpsertChunk(null, {}),
      actions.adminRetireChunk("0199f0a2-0000-7000-8000-000000000000", true),
    ];
    for (const r of await Promise.all(calls))
      expect(r).toEqual({ ok: false, error: { code: "forbidden", message: "Admins only." } });
    const subs = await import("@/server/actions/submissions");
    expect(await subs.adminDecideSubmission({})).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });
});

describe("admin user management (FR-051)", () => {
  it("lists with filters by plan, status and level", async () => {
    const a = await createLearner(db, { level: "C1", name: "Cara Filter" });
    const b = await createLearner(db, { level: "C1", name: "Dan Filter", emailVerified: false });
    await db
      .insert(subscription)
      .values({
        userId: a.id,
        tier: "standard",
        status: "active",
        currentPeriodEnd: new Date("2026-11-16T00:00:00Z"),
      });
    const standard = await listUsers({ plan: "standard" });
    expect(standard.rows.map((r) => r.id)).toEqual([a.id]);
    expect(standard.rows[0]).toMatchObject({ tier: "standard", subStatus: "active" });
    expect(standard.rows[0]!.renewsAt?.toISOString()).toBe("2026-11-16T00:00:00.000Z");
    const unverifiedC1 = await listUsers({ level: "C1", status: "unverified" });
    expect(unverifiedC1.rows.map((r) => r.id)).toEqual([b.id]);
    expect((await listUsers({ q: "Dan Filt" })).rows.map((r) => r.id)).toEqual([b.id]);
    const basic = await listUsers({ plan: "basic", level: "C1" });
    expect(basic.rows.map((r) => r.id)).toEqual([b.id]); // no subscription row = free Basic
  });

  it("creates verified users through Better Auth and audits it", async () => {
    const admin = await createLearner(db, { role: "admin" });
    const { id } = await createUser(admin.id, {
      name: "New Person",
      username: "new_person",
      email: "New@Example.com",
      password: "a-good-pass-1",
      level: "A2",
    });
    const [u] = await db.select().from(user).where(eq(user.id, id));
    expect(u).toMatchObject({
      email: "new@example.com",
      username: "new_person",
      level: "A2",
      emailVerified: true,
      role: "learner",
    });
    const signIn = await auth().api.signInEmail({
      body: { email: "new@example.com", password: "a-good-pass-1" },
    });
    expect(signIn.user.id).toBe(id);
    expect(
      (await db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, id))).map(
        (r) => r.action,
      ),
    ).toEqual(["user.create"]);
  });

  it("suspends: revokes sessions, blocks sign-in, and logs the action; can't suspend yourself", async () => {
    const admin = await createLearner(db, { role: "admin" });
    const { id } = await createUser(admin.id, {
      name: "Sus Pect",
      username: "sus_pect",
      email: "sus@example.com",
      password: "a-good-pass-1",
      level: "B1",
    });
    await auth().api.signInEmail({ body: { email: "sus@example.com", password: "a-good-pass-1" } });
    expect((await db.select().from(session).where(eq(session.userId, id))).length).toBeGreaterThan(
      0,
    );

    await setSuspended(admin.id, id, true, "spam");
    expect(await db.select().from(session).where(eq(session.userId, id))).toHaveLength(0);
    await expect(
      auth().api.signInEmail({ body: { email: "sus@example.com", password: "a-good-pass-1" } }),
    ).rejects.toThrow();
    await expect(setSuspended(admin.id, admin.id, true)).rejects.toMatchObject({
      code: "validation",
    });

    await setSuspended(admin.id, id, false);
    await expect(
      auth().api.signInEmail({ body: { email: "sus@example.com", password: "a-good-pass-1" } }),
    ).resolves.toBeTruthy();
    const actions = (
      await db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, id))
    ).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["user.suspend", "user.unsuspend"]));
  });

  it("edits level and refuses self role changes", async () => {
    const admin = await createLearner(db, { role: "admin" });
    const u = await createLearner(db);
    await updateUser(admin.id, u.id, { level: "C2" });
    const [after] = await db.select().from(user).where(eq(user.id, u.id));
    expect(after!.level).toBe("C2");
    await expect(updateUser(admin.id, admin.id, { role: "learner" })).rejects.toMatchObject({
      code: "validation",
    });
  });
});

describe("admin chunk editing (T123)", () => {
  it("accepts inflected examples and rejects examples without the chunk", () => {
    expect(exampleContainsChunk("spill the beans", "Someone spilled the beans about it.")).toBe(
      true,
    );
    expect(
      exampleContainsChunk("look forward to [doing]", "I'm looking forward to seeing you."),
    ).toBe(true);
    expect(exampleContainsChunk("spill the beans", "Tell me the secret now.")).toBe(false);
  });

  it("refuses to save a chunk whose example doesn't contain it", async () => {
    const admin = await createLearner(db, { role: "admin" });
    await expect(
      upsertChunk(admin.id, null, {
        text: "hit the sack",
        type: "idiom",
        level: "B2",
        registers: ["casual"],
        meaning: "go to bed",
        usageNote: "informal",
        examples: [
          { text: "I'm tired, time to hit the sack.", register: "casual" },
          { text: "She went to bed early.", register: "casual" },
          { text: "Let's hit the sack.", register: "casual" },
        ],
      }),
    ).rejects.toMatchObject({ code: "validation", message: expect.stringMatching(/Example 2/) });
  });
});
