import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChunkDraft } from "@/lib/contracts/llm";

const draft = (register: string) => ({
  text: "lend credence to",
  type: "collocation",
  level: "C2",
  registers: ["academic", "professional"],
  meaning: "To make an idea seem more likely to be true.",
  usageNote: "Use it in formal writing when evidence supports a claim.",
  examples: [
    { text: "New data lends credence to the theory.", register },
    { text: "Her story lends credence to his.", register: "casual" },
    { text: "The audit lends credence to our concerns.", register: "professional" },
  ],
});

describe("ChunkDraft contract (FR-011: examples are casual or professional)", () => {
  // T164: academic seeds made Gemma label an example "academic" about half the time, failing the
  // draft. Formal-style labels map to "professional" deterministically.
  it.each(["academic", "formal", "Academic"])("maps an example labeled %s to professional", (r) => {
    const out = ChunkDraft.parse(draft(r));
    expect(out.examples[0]!.register).toBe("professional");
  });

  it("still rejects unknown example registers", () => {
    expect(() => ChunkDraft.parse(draft("poetic"))).toThrow();
  });

  it("can still be stated as JSON Schema in the prompt", () => {
    const schema = JSON.stringify(z.toJSONSchema(ChunkDraft, { io: "input" }));
    expect(schema).toContain('"examples"');
  });
});
