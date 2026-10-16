import { describe, expect, it } from "vitest";
import { daysBetween, localHour, nextDayStart, practiceDateFor } from "@/lib/domain/time";

const instant = new Date("2026-10-16T03:30:00Z"); // late evening Oct 15 in Los Angeles

describe("time zones (R18)", () => {
  it("computes the learner-local practice date", () => {
    expect(practiceDateFor("America/Los_Angeles", instant)).toBe("2026-10-15");
    expect(practiceDateFor("Asia/Tokyo", instant)).toBe("2026-10-16");
    expect(practiceDateFor("UTC", instant)).toBe("2026-10-16");
  });

  it("falls back to UTC for missing or invalid zones", () => {
    expect(practiceDateFor(null, instant)).toBe("2026-10-16");
    expect(practiceDateFor("Mars/Olympus", instant)).toBe("2026-10-16");
  });

  it("returns the local hour for reminders", () => {
    expect(localHour("America/Los_Angeles", instant)).toBe(20);
    expect(localHour("Europe/Madrid", instant)).toBe(5);
  });

  it("finds the start of the next local day", () => {
    expect(nextDayStart("America/Los_Angeles", instant).toISOString()).toBe(
      "2026-10-16T07:00:00.000Z",
    );
    expect(nextDayStart("UTC", instant).toISOString()).toBe("2026-10-17T00:00:00.000Z");
  });

  it("handles daylight-saving transitions", () => {
    // US DST ends 2026-11-01: New York midnight is 04:00Z before and 05:00Z after the change.
    expect(nextDayStart("America/New_York", new Date("2026-11-01T12:00:00Z")).toISOString()).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });

  it("counts calendar days between dates", () => {
    expect(daysBetween("2026-10-14", "2026-10-15")).toBe(1);
    expect(daysBetween("2026-10-15", "2026-10-15")).toBe(0);
    expect(daysBetween("2026-10-28", "2026-11-02")).toBe(5);
  });
});
