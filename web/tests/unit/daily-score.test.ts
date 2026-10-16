import { describe, expect, it } from "vitest";
import { computeDailyScore, nextStreak } from "@/lib/domain/daily-score";

const weights = { speaking: 40, writing: 30, read_aloud: 30 };

describe("computeDailyScore (FR-018)", () => {
  it("weights try-2 speaking, writing, and read-aloud", () => {
    const out = computeDailyScore({ speaking: 80, writing: 90, readAloud: 70 }, weights);
    expect(out).toEqual({ score: Math.round(0.4 * 80 + 0.3 * 90 + 0.3 * 70), partial: false });
  });

  it("renormalizes over completed steps and marks the session partial (mic edge case)", () => {
    const out = computeDailyScore({ speaking: null, writing: 90, readAloud: null }, weights);
    expect(out).toEqual({ score: 90, partial: true });
  });

  it("returns 0 and partial when nothing was completed", () => {
    expect(computeDailyScore({ speaking: null, writing: null, readAloud: null }, weights)).toEqual({
      score: 0,
      partial: true,
    });
  });

  it("clamps to 0–100", () => {
    expect(computeDailyScore({ speaking: 100, writing: 100, readAloud: 100 }, weights).score).toBe(
      100,
    );
  });
});

describe("nextStreak", () => {
  it("starts at 1 for a first practice", () => {
    expect(nextStreak({ current: 0, longest: 0, lastPracticeDate: null }, "2026-10-16")).toEqual({
      current: 1,
      longest: 1,
    });
  });

  it("continues on consecutive days and raises the longest streak", () => {
    expect(
      nextStreak({ current: 4, longest: 4, lastPracticeDate: "2026-10-15" }, "2026-10-16"),
    ).toEqual({
      current: 5,
      longest: 5,
    });
  });

  it("does not double-count a second practice on the same day", () => {
    expect(
      nextStreak({ current: 5, longest: 9, lastPracticeDate: "2026-10-16" }, "2026-10-16"),
    ).toEqual({
      current: 5,
      longest: 9,
    });
  });

  it("resets to 1 after a gap but keeps the longest (US3 scenario 2)", () => {
    expect(
      nextStreak({ current: 7, longest: 12, lastPracticeDate: "2026-10-14" }, "2026-10-16"),
    ).toEqual({
      current: 1,
      longest: 12,
    });
  });

  it("uses the session's start date, so crossing midnight still counts for the start day", () => {
    // Session started 23:55 on the 15th (practiceDate "2026-10-15"), finished after midnight.
    expect(
      nextStreak({ current: 2, longest: 2, lastPracticeDate: "2026-10-14" }, "2026-10-15"),
    ).toEqual({
      current: 3,
      longest: 3,
    });
  });
});
