import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("blocks unmocked network requests", async () => {
    await expect(fetch("https://example.com/")).rejects.toThrow();
  });
});
