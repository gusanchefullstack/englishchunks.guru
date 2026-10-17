import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { createSignedInLearner, sql } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });
const cleanup = () =>
  sql(
    `delete from "user" where name in ('Tara Target', 'Ann Admin', 'Lou Learner') and email like '%@e2e.test'`,
  );
test.beforeAll(cleanup);
test.afterAll(cleanup);

test("learners can't see admin; admin filters, edits level and suspends (US6, V11)", async ({
  page,
  request,
  context,
  browser,
}) => {
  // A learner gets a 404 for every admin page (the area's existence isn't revealed).
  await createSignedInLearner(request, context, { name: "Lou Learner" });
  for (const path of ["/admin", "/admin/users", "/admin/chunks"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }

  const targetCtx = await browser.newContext({ baseURL: "http://localhost:3100" });
  const target = await createSignedInLearner(request, targetCtx, {
    name: "Tara Target",
    level: "A2",
  });
  await targetCtx.close();

  const adminCtx = await browser.newContext({ baseURL: "http://localhost:3100" });
  await createSignedInLearner(request, adminCtx, { name: "Ann Admin", extra: "role = 'admin'" });
  const admin = await adminCtx.newPage();

  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expectNoA11yViolations(admin);

  await admin.goto("/admin/users");
  await admin.getByLabel("Search users").fill(target.email);
  await admin.getByRole("search").getByLabel("Level").selectOption("A2");
  await admin.getByRole("button", { name: "Filter" }).click();
  await expect(admin.getByRole("status")).toHaveText("1 user");
  await expectNoA11yViolations(admin);
  await admin.getByRole("table").getByRole("link").first().click();

  await expect(admin.getByRole("heading", { level: 1, name: "Tara Target" })).toBeVisible();
  await expect(admin.getByText("none on file")).toBeVisible();
  await expectNoA11yViolations(admin);
  await admin.getByLabel("English level").selectOption("B2");
  await expect(admin.getByText("Level updated")).toBeVisible();
  await admin.getByRole("button", { name: "Suspend user" }).click();
  await expect(admin.getByRole("button", { name: "Reinstate user" })).toBeVisible();
  await expect(admin.getByText(/suspended \(/)).toBeVisible();

  const [row] = await sql<{ level: string; banned: boolean }>(
    `select level, banned from "user" where id = $1`,
    [target.id],
  );
  expect(row).toEqual({ level: "B2", banned: true });
  const [audit] = await sql<{ n: string }>(
    `select count(*) as n from admin_audit_log where target_id = $1 and action = 'user.suspend'`,
    [target.id],
  );
  expect(Number(audit!.n)).toBe(1);

  // The suspended learner can't sign in.
  const res = await request.post("/api/auth/sign-in/email", {
    data: { email: target.email, password: "e2e-password-123" },
  });
  expect(res.ok()).toBe(false);
  await adminCtx.close();
});
