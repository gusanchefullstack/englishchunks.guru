import { describe, expect, it } from "vitest";
import { normalizeChunkText } from "@/lib/domain/normalize";

describe("normalizeChunkText", () => {
  it.each([
    ["That makes sense.", "that makes sense"],
    ["I’m looking forward to it", "i am looking forward to it"],
    ["look forward to [doing]", "look forward to _slot_"],
    ["encourage someone to do", "encourage _slot_ to do"],
    ["a double-edged sword", "a double edged sword"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeChunkText(input)).toBe(expected);
  });
});
