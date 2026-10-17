import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { subscription } from "@/db/schema";
import { getUserDetail } from "@/lib/domain/admin-users";
import { createTestDb } from "../helpers/db";
import { createLearner } from "../helpers/fixtures";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

describe("admin user detail (FR-052)", () => {
  it("shows only the payment method summary", async () => {
    const u = await createLearner(db);
    await db.insert(subscription).values({
      userId: u.id,
      tier: "premium",
      status: "active",
      stripeCustomerId: "cus_secret",
      stripeSubscriptionId: "sub_secret",
      pmBrand: "visa",
      pmLast4: "4242",
      pmExpMonth: 12,
      pmExpYear: 2029,
      currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
    });
    const d = await getUserDetail(u.id);
    expect(d.subscription.paymentMethod).toEqual({
      type: "card",
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2029,
    });
    expect(d.subscription).toMatchObject({ tier: "premium", status: "active" });
    const json = JSON.stringify(d);
    expect(json).not.toContain("cus_secret");
    expect(json).not.toContain("sub_secret");
  });

  it("reports free Basic for learners without a subscription", async () => {
    const u = await createLearner(db);
    const d = await getUserDetail(u.id);
    expect(d.subscription).toMatchObject({
      tier: "basic",
      status: "free_basic",
      paymentMethod: null,
    });
  });
});
