import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { pointsLedger } from "@/db/schema";
import { getRanking, isoWeekStart } from "@/lib/domain/ranking";
import { createTestDb } from "../helpers/db";
import { createLearner } from "../helpers/fixtures";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

const now = new Date("2026-10-16T12:00:00Z"); // Friday; ISO week starts Mon 2026-10-12
async function give(userId: string, amount: number, at: string) {
  await db.insert(pointsLedger).values({
    userId,
    reason: "admin_adjustment",
    amount,
    refId: crypto.randomUUID(),
    earnedAt: new Date(at),
  });
}

describe("ranking (FR-032)", () => {
  it("computes the ISO week start in UTC", () => {
    expect(isoWeekStart(now).toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("ranks within the level band by default, overall on request, by week or all time", async () => {
    const a = await createLearner(db, { name: "Ana B1", level: "B1" });
    const b = await createLearner(db, { name: "Ben B2", level: "B2" });
    const c = await createLearner(db, { name: "Cy A2", level: "A2" });
    await give(a.id, 30, "2026-10-13T10:00:00Z");
    await give(b.id, 50, "2026-10-01T10:00:00Z"); // last week
    await give(b.id, 10, "2026-10-14T10:00:00Z");
    await give(c.id, 100, "2026-10-14T10:00:00Z");

    const weekBand = await getRanking({
      userId: a.id,
      level: "B1",
      scope: "band",
      period: "week",
      now,
    });
    expect(weekBand.top.map((e) => e.name)).toEqual(["Ana B1", "Ben B2"]);
    expect(weekBand.me).toMatchObject({ position: 1, points: 30 });

    const allBand = await getRanking({
      userId: a.id,
      level: "B1",
      scope: "band",
      period: "all",
      now,
    });
    expect(allBand.top.map((e) => e.name)).toEqual(["Ben B2", "Ana B1"]);

    const overall = await getRanking({
      userId: a.id,
      level: "B1",
      scope: "overall",
      period: "week",
      now,
    });
    expect(overall.top.map((e) => e.name)).toEqual(["Cy A2", "Ana B1", "Ben B2"]);
    expect(overall.me!.position).toBe(2);
  });

  it("hides opted-out and suspended learners but shows the opted-out learner their own position", async () => {
    const hidden = await createLearner(db, { name: "Hidden", level: "C1", rankingVisible: false });
    const shown = await createLearner(db, { name: "Shown", level: "C1" });
    const banned = await createLearner(db, { name: "Banned", level: "C2", banned: true });
    await give(hidden.id, 40, "2026-10-14T10:00:00Z");
    await give(shown.id, 20, "2026-10-14T10:00:00Z");
    await give(banned.id, 90, "2026-10-14T10:00:00Z");

    const asShown = await getRanking({
      userId: shown.id,
      level: "C1",
      scope: "band",
      period: "week",
      now,
    });
    expect(asShown.top.map((e) => e.name)).toEqual(["Shown"]);

    const asHidden = await getRanking({
      userId: hidden.id,
      level: "C1",
      scope: "band",
      period: "week",
      now,
    });
    expect(asHidden.top.map((e) => e.name)).toEqual(["Shown"]);
    expect(asHidden.me).toMatchObject({ position: 1, visible: false });
  });

  it("exposes only display name and picture, never email", async () => {
    const r = await getRanking({
      userId: "nobody",
      level: "B1",
      scope: "overall",
      period: "all",
      now,
    });
    expect(JSON.stringify(r)).not.toMatch(/@example\.com/);
  });
});
