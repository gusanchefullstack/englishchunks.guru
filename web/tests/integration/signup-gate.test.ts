import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { appSetting, user, waitlistEntry } from "@/db/schema";
import { auth, resetAuth } from "@/lib/auth";
import { deleteAccount } from "@/lib/domain/account-deletion";
import { expireInvites, inviteEntries, joinWaitlist, signupOpen } from "@/lib/domain/signup-gate";
import { setTestEnv } from "@/lib/env";
import { MemoryStorage, setStorage } from "@/lib/providers/storage";
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
  setStorage(new MemoryStorage());
  resetAuth();
});
afterAll(async () => {
  mail.restore();
  setStorage(undefined);
  await close();
});

let n = 0;
const signUp = (extra: Record<string, unknown> = {}) => {
  n++;
  return auth().api.signUpEmail({
    body: {
      email: `gate${n}@example.com`,
      username: `gate_${n}`,
      password: "a-good-pass-1",
      name: "Gate",
      ageConfirmed: true,
      ...extra,
    } as never,
  });
};

describe("sign-up gate (FR-055)", () => {
  it("allows sign-up under the cap and refuses at the cap", async () => {
    const admin = await createLearner(db, { role: "admin" });
    await createLearner(db);
    await db.update(appSetting).set({ accountCap: 2 });
    expect((await signupOpen()).open).toBe(true); // admins don't count: 1 learner < 2
    await signUp();
    expect(await signupOpen()).toMatchObject({ open: false, cap: 2, count: 2 });
    await expect(signUp()).rejects.toThrow(/waitlist/);
    expect(admin.role).toBe("admin");
  });

  it("lets a valid invite past the cap, once, for the invited email only", async () => {
    const admin = await createLearner(db, { role: "admin" });
    await joinWaitlist("Invited@Example.com");
    await joinWaitlist("invited@example.com"); // idempotent
    const [entry] = await db
      .select()
      .from(waitlistEntry)
      .where(eq(waitlistEntry.email, "invited@example.com"));
    const token = (await inviteEntries(admin.id, [entry!.id]))[0]!.token;
    const [stored] = await db.select().from(waitlistEntry).where(eq(waitlistEntry.id, entry!.id));
    expect(stored!.inviteTokenHash).not.toContain(token); // only a hash is stored

    await expect(signUp({ inviteToken: token, email: "someone.else@example.com" })).rejects.toThrow(
      /waitlist/,
    );
    await signUp({ inviteToken: token, email: "invited@example.com" });
    const [after] = await db.select().from(waitlistEntry).where(eq(waitlistEntry.id, entry!.id));
    expect(after).toMatchObject({ status: "registered", inviteTokenHash: null });
    await expect(
      signUp({ inviteToken: token, email: "invited@example.com", username: "again_x" }),
    ).rejects.toThrow();
  });

  it("expires invites after 7 days", async () => {
    const admin = await createLearner(db, { role: "admin" });
    await joinWaitlist("late@example.com");
    const [entry] = await db
      .select()
      .from(waitlistEntry)
      .where(eq(waitlistEntry.email, "late@example.com"));
    const token = (
      await inviteEntries(admin.id, [entry!.id], new Date(Date.now() - 8 * 86_400_000))
    )[0]!.token;
    await expect(signUp({ inviteToken: token, email: "late@example.com" })).rejects.toThrow(
      /waitlist/,
    );
    expect(await expireInvites()).toBeGreaterThanOrEqual(1);
    const [row] = await db.select().from(waitlistEntry).where(eq(waitlistEntry.id, entry!.id));
    expect(row!.status).toBe("expired");
  });

  it("deleting an account frees a place", async () => {
    const before = await signupOpen();
    expect(before.open).toBe(false);
    const [learner] = await db.select().from(user).where(eq(user.role, "learner")).limit(1);
    await deleteAccount(learner!.id);
    await db.update(appSetting).set({ accountCap: before.count - 1 + 1 });
    expect((await signupOpen()).open).toBe(true);
  });

  it("is always open when billing is active", async () => {
    await db.update(appSetting).set({ accountCap: 0, billingActive: true });
    expect((await signupOpen()).open).toBe(true);
    await signUp();
    await db.update(appSetting).set({ billingActive: false, accountCap: 200 });
  });

  it("admin-created accounts bypass the cap", async () => {
    await db.update(appSetting).set({ accountCap: 0 });
    const res = await auth().api.createUser({
      body: {
        email: "byadmin@example.com",
        password: "a-good-pass-1",
        name: "By Admin",
        role: "learner" as "user",
      },
    });
    expect(res.user.email).toBe("byadmin@example.com");
    await db.update(appSetting).set({ accountCap: 200 });
  });
});
