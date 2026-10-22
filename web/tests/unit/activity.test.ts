import { describe, expect, it } from "vitest";
import { ACTIVITY_REFRESH_MS, isActivityStale } from "@/lib/domain/activity";

const now = new Date("2026-10-21T12:00:00Z");

describe("isActivityStale", () => {
  it("treats never-active users as stale", () => {
    expect(isActivityStale(null, now)).toBe(true);
    expect(isActivityStale(undefined, now)).toBe(true);
  });
  it("skips refreshes inside the window", () => {
    expect(isActivityStale(new Date(now.getTime() - ACTIVITY_REFRESH_MS + 1000), now)).toBe(false);
  });
  it("refreshes once the window has passed (Date or ISO string)", () => {
    const old = new Date(now.getTime() - ACTIVITY_REFRESH_MS);
    expect(isActivityStale(old, now)).toBe(true);
    expect(isActivityStale(old.toISOString(), now)).toBe(true);
  });
});
