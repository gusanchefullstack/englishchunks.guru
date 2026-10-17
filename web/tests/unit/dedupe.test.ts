import { describe, expect, it } from "vitest";
import { dedupeKey, findDuplicates, lemma, similarity } from "@/lib/domain/dedupe";
import { devChunks } from "@/db/seed/dev-chunks";

const library = devChunks.map((c, i) => ({ id: String(i), text: c.text }));

describe("dedupe key", () => {
  it("normalizes case, punctuation, contractions, slots and simple verb forms", () => {
    expect(dedupeKey("Spilled the Beans!")).toBe("spill the bean");
    expect(dedupeKey("I'm looking forward to it")).toBe(dedupeKey("i am look forward to it"));
    expect(dedupeKey("encourage someone to do")).toBe(dedupeKey("encourage [somebody] to do"));
    expect(lemma("decisions")).toBe("decision");
    expect(lemma("made")).toBe("make");
    expect(lemma("stopped")).toBe("stop");
  });

  it("matches pg_trgm similarity semantics", () => {
    expect(similarity("word", "word")).toBe(1);
    expect(similarity("abc", "xyz")).toBe(0);
  });
});

// Near-duplicates a learner might type for chunks already in the library (SC-010 fixture).
const NEAR: [string, string][] = [
  ["spilled the beans", "spill the beans"],
  ["Spill the bean", "spill the beans"],
  ["make decisions", "make a decision"],
  ["made a decision", "make a decision"],
  ["by the way,", "by the way"],
  ["BY THE WAY", "by the way"],
  ["that make sense", "that makes sense"],
  ["That makes sense!", "that makes sense"],
  ["take breaks", "take a break"],
  ["took a break", "take a break"],
  ["got used to", "get used to"],
  ["getting used to", "get used to"],
  ["see you later!", "See you later"],
  ["thank you so much!!", "thank you so much"],
  ["having said this", "having said that"],
  ["on the other side", "on the other hand"],
  ["came up with", "come up with"],
  ["coming up with", "come up with"],
  ["bearing in mind", "bear in mind"],
  ["took into account", "take into account"],
  ["a double edged sword", "a double-edged sword"],
  ["strike the balance", "strike a balance"],
  ["in the grand scheme", "in the grand scheme of things"],
  ["Hows it going", "How's it going?"],
];

describe("duplicate detection (FR-043, SC-010)", () => {
  it("suggests the existing chunk for at least 90% of near-duplicates", () => {
    const hits = NEAR.filter(([typed, existing]) => {
      const r = findDuplicates(typed, library);
      return r.exact?.text === existing || r.similar.some((s) => s.text === existing);
    });
    const misses = NEAR.filter((n) => !hits.includes(n)).map(([t]) => t);
    expect(hits.length / NEAR.length, `misses: ${misses.join(" | ")}`).toBeGreaterThanOrEqual(0.9);
  });

  it("treats a genuinely new chunk as new", () => {
    for (const novel of [
      "break the ice",
      "under the weather",
      "it's raining cats and dogs",
      "call it a day",
    ]) {
      const r = findDuplicates(novel, library);
      expect(r.exact, novel).toBeNull();
      expect(r.similar, novel).toHaveLength(0);
    }
  });

  it("returns at most 3 similar suggestions, best first", () => {
    const r = findDuplicates("the end of the day", library);
    expect(r.similar.length).toBeLessThanOrEqual(3);
    const scores = r.similar.map((s) => s.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});
