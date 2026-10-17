import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { user, verification } from "@/db/schema";
import { auth, resetAuth } from "@/lib/auth";
import { authorizeLearner } from "@/lib/authz";
import { setTestEnv } from "@/lib/env";
import { createTestDb } from "../helpers/db";
import { captureEmails } from "../helpers/email";

let db: Db;
let close: () => Promise<void>;
const mail = captureEmails();
beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  resetAuth();
});
afterAll(async () => {
  mail.restore();
  await close();
});

const base = { password: "correct horse 9", name: "Lee" };

describe("sign-up and verification (US2)", () => {
  it("requires confirming 16+ (FR-007)", async () => {
    await expect(
      auth().api.signUpEmail({ body: { ...base, email: "noage@example.com", username: "noage" } }),
    ).rejects.toThrow(/16 or older/);
    expect(await db.select().from(user).where(eq(user.email, "noage@example.com"))).toHaveLength(0);
  });

  it("stamps age confirmation and keeps the browser time zone", async () => {
    await auth().api.signUpEmail({
      body: {
        ...base,
        email: "lee@example.com",
        username: "lee_01",
        ageConfirmed: true,
        timeZone: "Europe/Madrid",
      } as never,
    });
    const [u] = await db.select().from(user).where(eq(user.email, "lee@example.com"));
    expect(u!.ageConfirmedAt).toBeInstanceOf(Date);
    expect(u!.timeZone).toBe("Europe/Madrid");
    expect(u!.emailVerified).toBe(false);
  });

  it("blocks practice until verified, then the emailed link verifies the account", async () => {
    const [u] = await db.select().from(user).where(eq(user.email, "lee@example.com"));
    expect(() => authorizeLearner({ ...u!, level: "B1" })).toThrow(/confirm your email/i);
    const link = mail.lastLink();
    expect(link).toContain("/api/auth/verify-email?token=");
    const res = await auth().handler(new Request(link));
    expect(res.status).toBeLessThan(400);
    const [after] = await db.select().from(user).where(eq(user.email, "lee@example.com"));
    expect(after!.emailVerified).toBe(true);
  });
});

describe("Google account linking (spec edge case, analysis I1)", () => {
  it("never links implicitly: an existing password account must sign in first", () => {
    const linking = auth().options.account?.accountLinking;
    expect(linking).toMatchObject({
      enabled: true,
      disableImplicitLinking: true,
      trustedProviders: [],
    });
  });

  it("explicit linking requires an authenticated session", async () => {
    await expect(
      auth().api.linkSocialAccount({ body: { provider: "google" }, headers: new Headers() }),
    ).rejects.toThrow();
  });
});

describe("password reset (FR-002)", () => {
  it("sends a single-use link that expires in 1 hour", async () => {
    await auth().api.requestPasswordReset({
      body: { email: "lee@example.com", redirectTo: "/reset-password" },
    });
    const link = mail.lastLink();
    const token = new URL(link).pathname.split("/").pop()!;
    const rows = await db.select().from(verification);
    const row = rows.find((r) => r.identifier.includes(token));
    expect(row).toBeDefined();
    const minutes = (row!.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(58);
    expect(minutes).toBeLessThanOrEqual(60);

    await auth().api.resetPassword({ body: { token, newPassword: "a brand new pass 7" } });
    await expect(
      auth().api.resetPassword({ body: { token, newPassword: "another pass 8" } }),
    ).rejects.toThrow();
    const res = await auth().api.signInEmail({
      body: { email: "lee@example.com", password: "a brand new pass 7" },
    });
    expect(res.user.email).toBe("lee@example.com");
  });
});
