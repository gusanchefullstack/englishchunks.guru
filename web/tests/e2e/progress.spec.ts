import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { createSignedInLearner, sql } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });

const NAMES = ["Maya Progress", "Rival Bee", "Other Band"];
const cleanup = () =>
  sql(`delete from "user" where name = any($1) and email like '%@e2e.test'`, [NAMES]);
test.beforeAll(cleanup);
test.afterAll(cleanup);

const isoDay = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

test("progress shows seeded history, streak, ranking toggles and a table view (US3, V7)", async ({
  page,
  request,
  context,
}) => {
  const me = await createSignedInLearner(request, context, {
    name: "Maya Progress",
    level: "B2",
    extra: `current_streak = 3, longest_streak = 10, last_practice_date = '${isoDay(0)}'`,
  });
  const rival = await createSignedInLearner(
    request,
    await page.context().browser()!.newContext({ baseURL: "http://localhost:3100" }),
    { name: "Rival Bee", level: "B1" },
  );
  const outsider = await createSignedInLearner(
    request,
    await page.context().browser()!.newContext({ baseURL: "http://localhost:3100" }),
    { name: "Other Band", level: "C2" },
  );

  const [chunk] = await sql<{ id: string }>(`select id from chunk limit 1`);
  for (let offset = -13; offset <= 0; offset++) {
    if (offset === -3) continue; // the gap
    await sql(
      `insert into practice_session (id, user_id, chunk_id, origin, practice_date, step, status, daily_score, speak1_score, speak2_score)
       values (gen_random_uuid(), $1, $2, 'library', $3, 'done', 'completed', $4, 60, 72)`,
      [me.id, chunk!.id, isoDay(offset), 70 + offset + 13],
    );
  }
  await sql(
    `insert into points_ledger (id, user_id, reason, amount, ref_id, earned_at) values (gen_random_uuid(), $1, 'admin_adjustment', 120, gen_random_uuid(), now())`,
    [me.id],
  );
  await sql(
    `insert into points_ledger (id, user_id, reason, amount, ref_id, earned_at) values (gen_random_uuid(), $1, 'admin_adjustment', 200, gen_random_uuid(), now())`,
    [rival.id],
  );
  await sql(
    `insert into points_ledger (id, user_id, reason, amount, ref_id, earned_at) values (gen_random_uuid(), $1, 'admin_adjustment', 999, gen_random_uuid(), now())`,
    [outsider.id],
  );

  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: /look how far you've come/i })).toBeVisible();
  await expect(page.getByText("Current streak").locator("..")).toContainText("3");
  await expect(page.getByText(/your longest is 10 days/i)).toBeVisible();
  await expect(page.getByText(/try 2 scores 12 points higher/i)).toBeVisible();
  await expectNoA11yViolations(page);

  // Band ranking (B1–B2): rival first, me second; the C2 learner isn't in my band.
  const around = page.getByRole("list").filter({ hasText: "Rival Bee" });
  await expect(around).toContainText("You");
  await expect(page.getByText("#2", { exact: true })).toBeVisible();
  await expect(page.getByText("Other Band")).toHaveCount(0);

  // Overall: the C2 learner appears.
  await page.getByRole("link", { name: "Everyone" }).click();
  await expect(page).toHaveURL(/scope=overall/);
  await expect(page.getByText("Other Band")).toBeVisible();
  await expect(page.getByText("#3", { exact: true })).toBeVisible();

  // 7-day range + table view
  await page.getByRole("link", { name: "7 days" }).click();
  await expect(page).toHaveURL(/range=7/);
  await page.getByText("Show as a table").click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(1 + 6); // header + 6 practiced days (one gap)
  await expectNoA11yViolations(page);
});
