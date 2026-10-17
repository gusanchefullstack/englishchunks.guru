import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { chunk } from "@/db/schema";
import { PAGE_SIZE, searchChunks } from "@/lib/domain/library";
import { normalizeChunkText } from "@/lib/domain/normalize";
import { createTestDb } from "../helpers/db";
import { seedAll } from "../helpers/fixtures";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedAll(db);
});
afterAll(() => close());

describe("library search (FR-041)", () => {
  it("finds a chunk by its words, even with small differences", async () => {
    const exact = await searchChunks({ q: "get used to" });
    expect(exact.items[0]!.text).toBe("get used to");
    const fuzzy = await searchChunks({ q: "getting used to" });
    expect(fuzzy.items.map((i) => i.text)).toContain("get used to");
  });

  it("searches meanings too", async () => {
    const r = await searchChunks({ q: "tell a secret" });
    expect(r.items.map((i) => i.text)).toContain("spill the beans");
  });

  it("filters by level, type and register", async () => {
    const r = await searchChunks({ level: "B1", type: "verb_pattern" });
    expect(r.items.map((i) => i.text)).toEqual(["get used to"]);
    const casualIdioms = await searchChunks({ type: "idiom", register: "casual" });
    expect(
      casualIdioms.items.every((i) => i.type === "idiom" && i.registers.includes("casual")),
    ).toBe(true);
    expect(casualIdioms.items.length).toBeGreaterThan(0);
  });

  it("paginates by 20 and reports totals", async () => {
    const p1 = await searchChunks({});
    const p2 = await searchChunks({ page: 2 });
    expect(p1.items).toHaveLength(PAGE_SIZE);
    expect(p2.items).toHaveLength(30 - PAGE_SIZE);
    expect(p1.total).toBe(30);
    expect(p1.pages).toBe(2);
  });

  it("only returns practicable chunks (active + audited)", async () => {
    await db.insert(chunk).values({
      text: "unaudited chunk",
      normalizedText: normalizeChunkText("unaudited chunk"),
      type: "idiom",
      level: "B1",
      registers: ["casual"],
      meaning: "pending review",
      usageNote: "x",
      ipa: "x",
      auditStatus: "failed",
    });
    const [retired] = await db.select().from(chunk).where(eq(chunk.text, "spill the beans"));
    await db.update(chunk).set({ status: "retired" }).where(eq(chunk.id, retired!.id));
    const r = await searchChunks({ q: "unaudited" });
    expect(r.items).toHaveLength(0);
    expect((await searchChunks({ q: "spill the beans" })).items.map((i) => i.text)).not.toContain(
      "spill the beans",
    );
    await db.update(chunk).set({ status: "active" }).where(eq(chunk.id, retired!.id));
  });

  it("ignores invalid filter values instead of failing", async () => {
    const r = await searchChunks({ level: "Z9", type: "nope", page: "abc" });
    expect(r.total).toBe(30);
  });
});
