import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { chunk, chunkExample } from "@/db/schema";
import { parseSeedCsv, seedLibrary } from "@/lib/domain/library-seeding";
import { setTestEnv } from "@/lib/env";
import { createTestDb } from "../helpers/db";
import { seedAll } from "../helpers/fixtures";
import { mockLlm } from "../helpers/llm";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  await seedAll(db);
});
afterAll(() => close());

const draft = (text: string, examples: string[]) => ({
  text, type: "idiom", level: "B2", registers: ["casual"], meaning: "a meaning", usageNote: "when to use it",
  examples: examples.map((t, i) => ({ text: t, register: i === 1 ? "professional" : "casual" })),
});
const pass = { verdict: "pass", levelOk: true, meaningAccurate: true, examplesNatural: true, examplesContainChunk: true, issues: [] };

describe("library seeding pipeline (T146, FR-040)", () => {
  it("parses CSV seeds with optional hints and comments", () => {
    const seeds = parseSeedCsv('text,level,type,register\n# idioms\nbreak the ice,B1,idiom,casual\n"bits and pieces, mostly",,vague_language,\nonce in a blue moon\n');
    expect(seeds).toEqual([
      { text: "break the ice", level: "B1", type: "idiom", register: "casual" },
      { text: "bits and pieces, mostly", level: undefined, type: "vague_language", register: undefined },
      { text: "once in a blue moon", level: undefined, type: undefined, register: undefined },
    ]);
  });

  it("imports audited chunks with espeak IPA, routes failures to review, skips existing ones", async () => {
    const m = mockLlm([
      draft("break the ice", ["He told a joke to break the ice.", "Let's break the ice.", "Games break the ice."]),
      pass,
      draft("hit the books", ["I need to hit the books.", "She hit the books.", "Time to study now."]), // ex 3 lacks the chunk
      pass,
    ]);
    const report = await seedLibrary([{ text: "break the ice" }, { text: "hit the books" }, { text: "Spill the beans" }], { concurrency: 1 });
    m.restore();
    expect(report).toMatchObject({ imported: 1, needsReview: 1, skipped: 1, errors: 0 });

    const [ice] = await db.select().from(chunk).where(eq(chunk.text, "break the ice"));
    expect(ice).toMatchObject({ auditStatus: "passed", ipa: "/break the ice/" });
    expect(await db.select().from(chunkExample).where(eq(chunkExample.chunkId, ice!.id))).toHaveLength(3);

    const [books] = await db.select().from(chunk).where(eq(chunk.text, "hit the books"));
    expect(books!.auditStatus).toBe("failed"); // goes to the admin audit-failed queue
    expect(JSON.stringify(books!.auditNotes)).toContain("Time to study now.");
  });

  it("keeps the curated seed level over the models' opinion (deterministic pedagogy)", async () => {
    const ex = ["It's a moot point now.", "That's a moot point.", "Whether he agrees is a moot point."];
    const m = mockLlm([
      draft("a moot point", ex), // draft says B2
      { ...pass, verdict: "fail", levelOk: false, suggestedLevel: "C1", issues: ["Level should be C1."] },
    ]);
    await seedLibrary([{ text: "a moot point", level: "C2" }], { concurrency: 1 });
    m.restore();
    const [row] = await db.select().from(chunk).where(eq(chunk.text, "a moot point"));
    expect(row!.level).toBe("C2");
    expect(row!.auditStatus).toBe("failed"); // the disagreement still goes to admin review
    expect(JSON.stringify(row!.auditNotes)).toContain("suggestedLevel");
  });
});
