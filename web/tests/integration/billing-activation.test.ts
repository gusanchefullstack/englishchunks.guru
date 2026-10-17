import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { adminAuditLog, appSetting, subscription, user } from "@/db/schema";
import { auth, resetAuth } from "@/lib/auth";
import { getTodayStatus } from "@/lib/domain/session-engine";
import { createCheckout, runDailyBilling, setBillingActive } from "@/lib/domain/subscription";
import { setTestEnv } from "@/lib/env";
import { setStripe } from "@/lib/providers/billing";
import { createTestDb } from "../helpers/db";
import { captureEmails } from "../helpers/email";
import { createLearner, seedAll } from "../helpers/fixtures";
import { mockStripe, stripeTestEnv } from "../helpers/stripe";

let db: Db;
let close: () => Promise<void>;
const mail = captureEmails();
beforeAll(async () => {
  setTestEnv(stripeTestEnv);
  setStripe(undefined);
  ({ db, close } = await createTestDb());
  await seedAll(db);
  resetAuth();
});
afterAll(async () => {
  mail.restore();
  await close();
});

describe("billing activation (FR-063)", () => {
  it("marks existing accounts as early testers on free Basic, audited", async () => {
    const admin = await createLearner(db, { role: "admin" });
    const tester = await createLearner(db);
    await setBillingActive(admin.id, true);
    const [u] = await db.select().from(user).where(eq(user.id, tester.id));
    const [sub] = await db.select().from(subscription).where(eq(subscription.userId, tester.id));
    expect(u!.earlyTester).toBe(true);
    expect(sub).toMatchObject({ tier: "basic", status: "free_basic" });
    expect((await getTodayStatus({ userId: tester.id, level: "B1", timeZone: "UTC" })).limit).toBe(
      1,
    );
    const [setting] = await db.select().from(appSetting);
    expect(setting).toMatchObject({ billingActive: true, billingChangedBy: admin.id });
    expect(
      (await db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "billing.activate")))
        .length,
    ).toBe(1);
  });

  it("starts a 7-day app-managed trial (Basic limit) for new sign-ups — no card needed", async () => {
    await auth().api.signUpEmail({
      body: {
        email: "late@example.com",
        username: "late_one",
        password: "a-good-pass-1",
        name: "Late",
        ageConfirmed: true,
      } as never,
    });
    const [u] = await db.select().from(user).where(eq(user.email, "late@example.com"));
    const [sub] = await db.select().from(subscription).where(eq(subscription.userId, u!.id));
    expect(u!.earlyTester).toBe(false);
    expect(sub).toMatchObject({ status: "trialing", tier: "basic", stripeSubscriptionId: null });
    const days = (sub!.trialEndsAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
    expect((await getTodayStatus({ userId: u!.id, level: "B1", timeZone: "UTC" })).limit).toBe(1);
  });

  it("warns a day before, then the daily job expires the trial → limit 0", async () => {
    const [u] = await db.select().from(user).where(eq(user.email, "late@example.com"));
    await db
      .update(subscription)
      .set({ trialEndsAt: new Date(Date.now() + 12 * 3_600_000) })
      .where(eq(subscription.userId, u!.id));
    const warn = await runDailyBilling();
    expect(warn.trialWarnings).toBe(1);
    expect(
      mail.sent.some((m) => m.to === "late@example.com" && /trial ends tomorrow/i.test(m.subject)),
    ).toBe(true);
    expect((await runDailyBilling()).trialWarnings).toBe(0); // once per day

    await db
      .update(subscription)
      .set({ trialEndsAt: new Date(Date.now() - 1000) })
      .where(eq(subscription.userId, u!.id));
    expect((await runDailyBilling()).expiredTrials).toBe(1);
    const status = await getTodayStatus({ userId: u!.id, level: "B1", timeZone: "UTC" });
    expect(status).toMatchObject({ limit: 0, remaining: 0 });
  });

  it("creates a Stripe customer once and opens hosted Checkout without a Stripe trial or payment_method_types", async () => {
    const stripe = mockStripe();
    const [u] = await db.select().from(user).where(eq(user.email, "late@example.com"));
    const r = await createCheckout(u!.id, "standard");
    expect(r.url).toBe("https://checkout.stripe.test/cs_1");
    const checkout = stripe.calls.find((c) => c.path === "/v1/checkout/sessions")!;
    const body = new URLSearchParams(checkout.body);
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("customer")).toBe("cus_new");
    expect(body.get("line_items[0][price]")).toBe("price_standard");
    expect(checkout.body).not.toContain("trial_period_days");
    expect(checkout.body).not.toContain("payment_method_types");
    await createCheckout(u!.id, "premium");
    expect(stripe.calls.filter((c) => c.path === "/v1/customers")).toHaveLength(1);
  });
});
