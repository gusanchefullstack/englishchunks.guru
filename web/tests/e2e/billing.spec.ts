import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { createSignedInLearner, sql } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });
const cleanup = async () => {
  await sql(`update app_setting set billing_active = false`);
  await sql(
    `delete from "user" where name in ('Bill Learner', 'Bea Admin') and email like '%@e2e.test'`,
  );
};
test.beforeAll(cleanup);
test.afterAll(cleanup);

test("billing page while free, then admin activation makes existing learners early testers (US8, V13)", async ({
  page,
  request,
  context,
  browser,
}) => {
  await createSignedInLearner(request, context, { name: "Bill Learner" });
  await page.goto("/billing");
  await expect(page.getByText(/everything is free while we're testing/i)).toBeVisible();
  await expect(page.getByText("Coming soon", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /choose/i })).toHaveCount(0); // no payment UI (FR-061)
  await expectNoA11yViolations(page);

  const adminCtx = await browser.newContext({ baseURL: "http://localhost:3100" });
  await createSignedInLearner(request, adminCtx, { name: "Bea Admin", extra: "role = 'admin'" });
  const admin = await adminCtx.newPage();
  await admin.goto("/admin/settings");
  await expectNoA11yViolations(admin);
  const activate = admin.getByRole("button", { name: /activate paid billing/i });
  await expect(activate).toBeDisabled();
  await admin.getByLabel(/type activate to confirm/i).fill("ACTIVATE");
  await activate.click();
  await expect(admin.getByText(/paid billing is/i)).toContainText("ACTIVE");
  await adminCtx.close();

  await page.reload();
  await expect(page.getByText(/early tester — basic stays free/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /choose standard/i })).toBeVisible();
});
