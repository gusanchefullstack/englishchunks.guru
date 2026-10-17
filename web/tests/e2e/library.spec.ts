import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { createSignedInLearner, sql } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });
const cleanup = () =>
  sql(`delete from "user" where name = 'Libby Library' and email like '%@e2e.test'`);
test.beforeAll(cleanup);
test.afterAll(cleanup);

test("search, filter, open a lesson, practice it, then hit the daily limit (US4, V9)", async ({
  page,
  request,
  context,
}) => {
  await createSignedInLearner(request, context, { name: "Libby Library", level: "B1" });

  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Chunk library" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("30 chunks");
  await expectNoA11yViolations(page);

  // Text search
  await page
    .getByRole("searchbox", { name: /search chunks/i })
    .or(page.getByLabel("Search chunks"))
    .fill("get used to");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=get\+used\+to/);
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("get used to");

  // Filters: B1 + verb pattern (URL state)
  await page.goto("/library");
  await page.getByLabel("Level").selectOption("B1");
  await page.getByLabel("Chunk type").selectOption("verb_pattern");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/level=B1.*type=verb_pattern|type=verb_pattern.*level=B1/);
  await expect(page.getByRole("status")).toContainText("1 matching chunk");
  await page.getByRole("link", { name: /open lesson: get used to/i }).click();

  // Detail + practice
  await expect(page.getByRole("heading", { level: 1, name: /get used to/ })).toBeVisible();
  await expect(page.getByText(/1 practice left today/)).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: /practice this chunk/i }).click();
  await expect(page).toHaveURL(/\/practice\//);
  await expect(page.getByRole("heading", { name: "Library practice" })).toBeVisible();

  // Limit shared with the daily session: another chunk can't be started today (Basic = 1)
  await page.goto("/library?type=idiom");
  await page
    .getByRole("link", { name: /open lesson/i })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /practice this chunk/i })).toBeDisabled();
  await expect(page.getByText(/you've used today's practices/i)).toBeVisible();
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: /you've done today's practice/i })).toBeVisible();
});
