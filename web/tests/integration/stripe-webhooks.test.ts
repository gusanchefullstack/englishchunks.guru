import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { appSetting, stripeEvent, subscription } from "@/db/schema";
import { getTodayStatus } from "@/lib/domain/session-engine";
import { processWebhook } from "@/lib/domain/stripe-webhook";
import { statusFromStripe } from "@/lib/domain/subscription";
import { setTestEnv } from "@/lib/env";
import { setStripe } from "@/lib/providers/billing";
import { createTestDb } from "../helpers/db";
import { captureEmails } from "../helpers/email";
import { createLearner, seedAll } from "../helpers/fixtures";
import { fakeSubscription, mockStripe, signedEvent, stripeTestEnv } from "../helpers/stripe";

let db: Db;
let close: () => Promise<void>;
const mail = captureEmails();
beforeAll(async () => {
  setTestEnv(stripeTestEnv);
  setStripe(undefined);
  ({ db, close } = await createTestDb());
  await seedAll(db);
  await db.update(appSetting).set({ billingActive: true });
});
afterAll(async () => {
  mail.restore();
  await close();
});

async function learnerWithCustomer(customer: string, earlyTester = false) {
  const u = await createLearner(db, { earlyTester });
  await db.insert(subscription).values({
    userId: u.id,
    stripeCustomerId: customer,
    status: "trialing",
    trialEndsAt: new Date(Date.now() + 86_400_000),
  });
  return u;
}

describe("Stripe webhooks (FR-062)", () => {
  it("rejects bad signatures", async () => {
    expect((await processWebhook("{}", "t=1,v1=bad")).status).toBe(400);
    expect((await processWebhook("{}", null)).status).toBe(400);
  });

  it("activates the plan from checkout, storing only payment-method display fields; replays are no-ops", async () => {
    const stripe = mockStripe();
    const u = await learnerWithCustomer("cus_a");
    stripe.subs.set(
      "sub_a",
      fakeSubscription({
        id: "sub_a",
        customer: "cus_a",
        status: "active",
        price: "price_standard",
      }),
    );
    const ev = await signedEvent("checkout.session.completed", {
      id: "cs_a",
      object: "checkout.session",
      mode: "subscription",
      subscription: "sub_a",
      customer: "cus_a",
      payment_status: "paid",
    });
    expect((await processWebhook(ev.payload, ev.header)).status).toBe(200);
    const [row] = await db.select().from(subscription).where(eq(subscription.userId, u.id));
    expect(row).toMatchObject({
      tier: "standard",
      status: "active",
      stripeSubscriptionId: "sub_a",
      trialEndsAt: null,
      pmBrand: "visa",
      pmLast4: "4242",
      pmExpMonth: 12,
      pmExpYear: 2029,
    });
    expect((await getTodayStatus({ userId: u.id, level: "B1", timeZone: "UTC" })).limit).toBe(3);

    const before = stripe.calls.length;
    expect((await processWebhook(ev.payload, ev.header)).status).toBe(200); // replay
    expect(stripe.calls.length).toBe(before); // nothing reprocessed
    expect(await db.select().from(stripeEvent).where(eq(stripeEvent.id, ev.id))).toHaveLength(1);
  });

  it("keeps the tier limit while past_due and emails the learner", async () => {
    const stripe = mockStripe();
    const u = await learnerWithCustomer("cus_b");
    stripe.subs.set(
      "sub_b",
      fakeSubscription({
        id: "sub_b",
        customer: "cus_b",
        status: "past_due",
        price: "price_premium",
      }),
    );
    const ev = await signedEvent("invoice.payment_failed", {
      id: "in_b",
      object: "invoice",
      customer: "cus_b",
      parent: { subscription_details: { subscription: "sub_b" } },
    });
    expect((await processWebhook(ev.payload, ev.header)).status).toBe(200);
    const [row] = await db.select().from(subscription).where(eq(subscription.userId, u.id));
    expect(row).toMatchObject({ status: "past_due", tier: "premium" });
    expect((await getTodayStatus({ userId: u.id, level: "B1", timeZone: "UTC" })).limit).toBe(5);
    expect(mail.sent.some((m) => m.to === u.email && /payment/i.test(m.subject))).toBe(true);
  });

  it("on cancellation: early testers fall back to free Basic, others expire", async () => {
    const stripe = mockStripe();
    const tester = await learnerWithCustomer("cus_c", true);
    const other = await learnerWithCustomer("cus_d", false);
    stripe.subs.set(
      "sub_c",
      fakeSubscription({
        id: "sub_c",
        customer: "cus_c",
        status: "canceled",
        price: "price_standard",
      }),
    );
    stripe.subs.set(
      "sub_d",
      fakeSubscription({
        id: "sub_d",
        customer: "cus_d",
        status: "canceled",
        price: "price_standard",
      }),
    );
    for (const id of ["sub_c", "sub_d"]) {
      const ev = await signedEvent("customer.subscription.deleted", { id, object: "subscription" });
      expect((await processWebhook(ev.payload, ev.header)).status).toBe(200);
    }
    expect(
      (await db.select().from(subscription).where(eq(subscription.userId, tester.id)))[0]!.status,
    ).toBe("free_basic");
    expect(
      (await db.select().from(subscription).where(eq(subscription.userId, other.id)))[0]!.status,
    ).toBe("expired");
    expect((await getTodayStatus({ userId: tester.id, level: "B1", timeZone: "UTC" })).limit).toBe(
      1,
    );
    expect((await getTodayStatus({ userId: other.id, level: "B1", timeZone: "UTC" })).limit).toBe(
      0,
    );
  });

  it("releases the event claim when processing fails so Stripe retries", async () => {
    mockStripe(); // subscription lookup will 404
    await learnerWithCustomer("cus_e");
    const ev = await signedEvent("customer.subscription.updated", {
      id: "sub_missing",
      object: "subscription",
    });
    expect((await processWebhook(ev.payload, ev.header)).status).toBe(500);
    expect(await db.select().from(stripeEvent).where(eq(stripeEvent.id, ev.id))).toHaveLength(0);
  });

  it("maps Stripe statuses per the data model", () => {
    expect(statusFromStripe("active", false)).toBe("active");
    expect(statusFromStripe("past_due", false)).toBe("past_due");
    expect(statusFromStripe("unpaid", false)).toBe("expired");
    expect(statusFromStripe("unpaid", true)).toBe("free_basic");
    expect(statusFromStripe("incomplete", false)).toBe("none");
  });
});
