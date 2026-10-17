import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { getDailyLimit } from "@/lib/domain/limits";
import { createCheckout, getBillingView } from "@/lib/domain/subscription";
import { setTestEnv } from "@/lib/env";
import { setStripe } from "@/lib/providers/billing";
import { createTestDb } from "../helpers/db";
import { createLearner, seedAll } from "../helpers/fixtures";
import { mockStripe, stripeTestEnv } from "../helpers/stripe";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  setTestEnv(stripeTestEnv);
  setStripe(undefined);
  ({ db, close } = await createTestDb());
  await seedAll(db);
});
afterAll(() => close());

describe("billing inactive (FR-061, SC-009)", () => {
  it("never calls Stripe, refuses checkout, and keeps everyone on free Basic", async () => {
    const stripe = mockStripe();
    const u = await createLearner(db);
    await expect(createCheckout(u.id, "standard")).rejects.toMatchObject({
      code: "billing_inactive",
    });
    expect(stripe.calls).toHaveLength(0);
    expect(await getBillingView(u.id)).toMatchObject({
      billingActive: false,
      status: "free_basic",
      tier: "basic",
    });
    expect(getDailyLimit({ billingActive: false, subscription: null, earlyTester: false })).toBe(1);
  });
});
