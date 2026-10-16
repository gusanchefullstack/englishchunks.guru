import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import type { PlanTier, SubscriptionStatus } from "@/db/schema";
import { getDailyLimit, limitReachedError } from "@/lib/domain/limits";

const sub = (tier: PlanTier, status: SubscriptionStatus) => ({ tier, status });

describe("getDailyLimit", () => {
  it("is 1 for everyone while billing is inactive (FR-061)", () => {
    expect(getDailyLimit({ billingActive: false, subscription: null, earlyTester: false })).toBe(1);
    expect(
      getDailyLimit({
        billingActive: false,
        subscription: sub("premium", "active"),
        earlyTester: false,
      }),
    ).toBe(1);
  });

  it("follows the paid tier when active: basic 1, standard 3, premium 5 (FR-060)", () => {
    for (const [tier, n] of [
      ["basic", 1],
      ["standard", 3],
      ["premium", 5],
    ] as const) {
      expect(
        getDailyLimit({
          billingActive: true,
          subscription: sub(tier, "active"),
          earlyTester: false,
        }),
      ).toBe(n);
    }
  });

  it("keeps the paid tier limit while past_due (Stripe retries)", () => {
    expect(
      getDailyLimit({
        billingActive: true,
        subscription: sub("standard", "past_due"),
        earlyTester: false,
      }),
    ).toBe(3);
  });

  it("gives the Basic limit during the app-managed trial", () => {
    expect(
      getDailyLimit({
        billingActive: true,
        subscription: sub("basic", "trialing"),
        earlyTester: false,
      }),
    ).toBe(1);
  });

  it("keeps early testers on free Basic after activation and after cancelling (FR-063)", () => {
    expect(
      getDailyLimit({
        billingActive: true,
        subscription: sub("basic", "free_basic"),
        earlyTester: true,
      }),
    ).toBe(1);
    expect(
      getDailyLimit({
        billingActive: true,
        subscription: sub("standard", "canceled"),
        earlyTester: true,
      }),
    ).toBe(1);
  });

  it("blocks non-early-testers whose trial expired or who cancelled", () => {
    expect(
      getDailyLimit({
        billingActive: true,
        subscription: sub("basic", "expired"),
        earlyTester: false,
      }),
    ).toBe(0);
    expect(
      getDailyLimit({
        billingActive: true,
        subscription: sub("standard", "canceled"),
        earlyTester: false,
      }),
    ).toBe(0);
    expect(getDailyLimit({ billingActive: true, subscription: null, earlyTester: false })).toBe(0);
  });
});

describe("limitReachedError", () => {
  it("reports when practices reset in the learner's zone", () => {
    const err = limitReachedError(1, "UTC", new Date("2026-10-16T10:00:00Z"));
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("limit_reached");
    expect(err.details).toMatchObject({ resetsAt: "2026-10-17T00:00:00.000Z", limit: 1 });
  });

  it("explains that a plan is needed when the limit is 0", () => {
    expect(limitReachedError(0, "UTC").message).toMatch(/choose a plan/i);
  });
});
