import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { createSignedInLearner, sql } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });

let flagged: { id: string; text: string }[] = [];
test.beforeAll(async () => {
  flagged = await sql<{ id: string; text: string }>(
    `update chunk set audit_status = 'failed',
       audit_notes = '{"verdict":"fail","issues":["Level may be too high"],"suggestedLevel":"C1"}'
     where id in (select id from chunk where level = 'C2' and status = 'active' order by text limit 3)
     returning id, text`,
  );
  flagged.sort((a, b) => a.text.localeCompare(b.text));
});
test.afterAll(async () => {
  await sql(
    `update chunk set audit_status = 'passed', audit_notes = null, status = 'active' where id = any($1)`,
    [flagged.map((f) => f.id)],
  );
});

// Regression: approving used to land on the chunk page and the list then defaulted to "Active".
test("moderators decide in place and move on to the next flagged chunk", async ({
  page,
  request,
  context,
}) => {
  await createSignedInLearner(request, context, { name: "Mo Moderator", extra: "role = 'admin'" });
  await page.goto("/admin/chunks");
  await expect(page.getByRole("heading", { level: 1, name: "Chunk moderation" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: /Chunks\s*3 waiting for review/ })).toBeVisible();
  const queue = page.getByRole("list", { name: "Chunks to review" });
  await expect(queue.locator(":scope > li")).toHaveCount(3);
  await expect(queue.getByText("Auditor suggests C1").first()).toBeVisible();
  await expectNoA11yViolations(page);

  const [first, second, third] = flagged;
  await page.getByRole("button", { name: `Accept “${first!.text}”` }).click();
  await expect(queue.locator(":scope > li")).toHaveCount(2);
  await expect(page).toHaveURL(/\/admin\/chunks$/); // still in the queue
  await expect(page.getByRole("heading", { level: 2, name: `“${second!.text}”` })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Accepted" })).toContainText("2 left");

  await page.getByRole("button", { name: `Deny “${second!.text}”` }).click();
  await expect(queue.locator(":scope > li")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: /Chunks\s*1 waiting for review/ })).toBeVisible();

  // Editing from the queue saves (= approves) and comes back to the queue.
  await page.getByRole("link", { name: `Edit “${third!.text}”` }).click();
  await expect(page.getByRole("link", { name: /back to the review queue/i })).toBeVisible();
  await page.getByRole("button", { name: /save/i }).click();
  await expect(page).toHaveURL(/\/admin\/chunks$/);
  await expect(page.getByText(/all caught up/i)).toBeVisible();

  // Decisions are listed under their tabs.
  await page.getByRole("link", { name: "Rejected" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `“${second!.text}”` })).toBeVisible();
  await page.getByRole("link", { name: "Accepted" }).click();
  await expect(page.getByRole("heading", { level: 2, name: `“${first!.text}”` })).toBeVisible();
});
