import { describe, expect, it } from "vitest";
import { milestoneFor, sessionPoints } from "@/lib/domain/points";

describe("points rules (FR-031)", () => {
  it("awards round(daily_score / 10) per completed session", () => {
    expect(sessionPoints(89)).toBe(9);
    expect(sessionPoints(85)).toBe(9);
    expect(sessionPoints(84)).toBe(8);
    expect(sessionPoints(0)).toBe(0);
    expect(sessionPoints(null)).toBe(0);
  });

  it("awards streak milestones at 3/7/30/100 days", () => {
    expect(milestoneFor(3)).toBe(5);
    expect(milestoneFor(7)).toBe(15);
    expect(milestoneFor(30)).toBe(50);
    expect(milestoneFor(100)).toBe(150);
    expect(milestoneFor(4)).toBe(0);
    expect(milestoneFor(1)).toBe(0);
  });
});
