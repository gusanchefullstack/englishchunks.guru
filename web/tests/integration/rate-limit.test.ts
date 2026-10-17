import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../helpers/db";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) }));

let close: () => Promise<void>;
beforeAll(async () => ({ close } = await createTestDb()));
afterAll(() => close());

describe("rateLimit (T150)", () => {
  it("allows up to max per window per client IP, then blocks", async () => {
    const { clientIp, rateLimit } = await import("@/lib/rate-limit");
    expect(await clientIp()).toBe("203.0.113.7");
    for (let i = 0; i < 3; i++) await rateLimit("test-form", 3);
    await expect(rateLimit("test-form", 3)).rejects.toMatchObject({ code: "limit_reached" });
    await expect(rateLimit("other-form", 3)).resolves.toBeUndefined(); // separate bucket per action
  });

  it("can key by user instead of IP", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    await rateLimit("per-user", 1, 60, "user-a");
    await expect(rateLimit("per-user", 1, 60, "user-b")).resolves.toBeUndefined();
    await expect(rateLimit("per-user", 1, 60, "user-a")).rejects.toMatchObject({ code: "limit_reached" });
  });
});
