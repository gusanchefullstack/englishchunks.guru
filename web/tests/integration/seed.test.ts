import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { chunk, chunkExample, soundHint, voice } from "@/db/schema";
import { seedBase } from "@/db/seed/base";
import { devChunks, seedDevChunks } from "@/db/seed/dev-chunks";
import { seedSoundHints } from "@/db/seed/sound-hints";
import { createTestDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedBase(db);
  await seedSoundHints(db);
  await seedDevChunks(db);
});
afterAll(() => close());

describe("seed data", () => {
  it("has at least 4 active voices with mixed genders (FR-006)", async () => {
    const rows = await db.select().from(voice);
    expect(rows.filter((v) => v.active).length).toBeGreaterThanOrEqual(4);
    expect(new Set(rows.map((v) => v.gender))).toEqual(new Set(["female", "male"]));
  });

  it("loads the curated sound-hint table (~40 sounds)", async () => {
    const rows = await db.select().from(soundHint);
    expect(rows.length).toBeGreaterThanOrEqual(38);
  });

  it("has 30 dev chunks, 5 per level, each with exactly 3 examples", async () => {
    const chunks = await db.select().from(chunk);
    const examples = await db.select().from(chunkExample);
    expect(chunks).toHaveLength(30);
    for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"]) {
      expect(chunks.filter((c) => c.level === level)).toHaveLength(5);
    }
    for (const c of chunks) {
      expect(
        examples
          .filter((e) => e.chunkId === c.id)
          .map((e) => e.position)
          .sort(),
      ).toEqual([1, 2, 3]);
    }
  });

  it("has non-empty espeak-ng IPA on every chunk and example (never LLM-generated)", () => {
    for (const c of devChunks) {
      expect(c.ipa.length).toBeGreaterThan(0);
      for (const e of c.examples) expect(e.ipa.length).toBeGreaterThan(0);
    }
  });

  it("is idempotent", async () => {
    await seedBase(db);
    await seedSoundHints(db);
    await seedDevChunks(db);
    expect(await db.select().from(chunk)).toHaveLength(30);
  });
});
