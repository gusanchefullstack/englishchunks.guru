import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { createSignedInLearner, sql } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });
const cleanup = async () => {
  await sql(`delete from chunk_submission where text ilike 'break the ice'`);
  await sql(`delete from chunk where text = 'break the ice'`);
  await sql(
    `delete from "user" where name in ('Sam Suggester', 'Ada Admin') and email like '%@e2e.test'`,
  );
};
test.beforeAll(cleanup);
test.afterAll(cleanup);

test("suggest a chunk, admin accepts it, learner is notified (US5, V10)", async ({
  page,
  request,
  context,
  browser,
}) => {
  await createSignedInLearner(request, context, { name: "Sam Suggester" });

  await page.goto("/submit-chunk");
  await expect(page.getByRole("heading", { name: "Suggest a chunk" })).toBeVisible();
  await expectNoA11yViolations(page);

  // Existing chunk → told it's already there, can't submit
  await page.getByLabel("The chunk").fill("spilled the beans");
  await expect(page.getByText("This chunk is already in the library.")).toBeVisible();
  await expect(page.getByRole("button", { name: /suggest this chunk/i })).toBeDisabled();

  // New chunk → pending
  await page.getByLabel("The chunk").fill("break the ice");
  await page.getByLabel(/what it means/i).fill("Start a conversation in a relaxed way");
  await page.getByLabel(/an example sentence/i).fill("He told a joke to break the ice.");
  await expect(page.getByRole("button", { name: /suggest this chunk/i })).toBeEnabled();
  await page.getByRole("button", { name: /suggest this chunk/i }).click();
  await expect(page).toHaveURL(/\/my-submissions/);
  await expect(page.getByText("Waiting for review")).toBeVisible();

  // Learners can't open the admin queue
  const forbidden = await page.goto("/admin/submissions");
  expect(forbidden?.status()).toBe(404);

  // Admin accepts with complete details
  const adminCtx = await browser.newContext({ baseURL: "http://localhost:3100" });
  await createSignedInLearner(request, adminCtx, { name: "Ada Admin", extra: "role = 'admin'" });
  const admin = await adminCtx.newPage();
  await admin.goto("/admin/submissions");
  const card = admin.getByRole("listitem").filter({ hasText: "“break the ice”" });
  await expect(card).toBeVisible();
  await expectNoA11yViolations(admin);
  await card
    .getByLabel("When to use it")
    .fill("Use it when people feel shy at the start of a meeting.");
  await card.getByLabel("Example 2").fill("Let's break the ice with quick introductions.");
  await card.getByLabel("Example 3").fill("Games help kids break the ice.");
  await card.getByRole("button", { name: /accept and publish/i }).click();
  await expect(admin.getByText(/no submissions waiting/i)).toBeVisible();
  await adminCtx.close();

  // Learner: notification + accepted + in the library
  await page.goto("/my-submissions");
  await expect(page.getByText("Accepted · +20 points")).toBeVisible();
  await page
    .getByRole("button", { name: /notifications, 1 unread/i })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Notifications" }).getByText(/break the ice.*accepted/i),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open in the library" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /break the ice/ })).toBeVisible();
});
