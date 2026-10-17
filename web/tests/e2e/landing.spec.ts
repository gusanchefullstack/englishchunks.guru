import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { createSignedInLearner, sql } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });

const stamp = Date.now();
const VISITOR = `waiter.${stamp}@e2e.test`;
const restore = async () => {
  await sql(`update app_setting set account_cap = 200, billing_active = false`);
  await sql(`delete from waitlist_entry where email like '%@e2e.test'`);
  await sql(
    `delete from "user" where (email = $1 or name = 'Wendy Admin') and email like '%@e2e.test'`,
    [VISITOR],
  );
};
test.beforeAll(restore);
test.afterAll(restore);

for (const width of [375, 768, 1280]) {
  test(`landing explains chunks, shows plans, leads to sign-up (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /real english/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /ready-made blocks of meaning/i }),
    ).toBeVisible();
    await expect(page.getByText("“spill the beans”")).toBeVisible();
    await expect(page.getByRole("list", { name: /how a daily session works/i })).toBeVisible();
    await expect(page.getByText("Coming soon", { exact: true })).toHaveCount(2); // Standard + Premium while billing is off
    await expectNoA11yViolations(page);
    // No horizontal scrolling at any width
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page
      .getByRole("main")
      .getByRole("link", { name: /^start free/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-up/);
  });
}

test("at the account cap: waitlist, admin invite, invited visitor registers (US7, V12)", async ({
  page,
  request,
  browser,
}) => {
  const [row] = await sql<{ n: string }>(`select count(*) as n from "user" where role <> 'admin'`);
  await sql(`update app_setting set account_cap = $1`, [Number(row!.n)]);

  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Join the waitlist" })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByLabel("Email address").fill(VISITOR);
  await page.getByRole("button", { name: /join the waitlist/i }).click();
  await expect(page.getByText(/you're on the list/i)).toBeVisible();

  // Signing up directly is refused at the cap, server-side.
  const refused = await request.post("/api/auth/sign-up/email", {
    data: {
      email: VISITOR,
      name: "Wai Ter",
      username: `wai_${stamp % 100000}`,
      password: "waiting-pass-1",
      ageConfirmed: true,
    },
  });
  expect(refused.status()).toBe(403);

  // Admin invites the visitor (admins don't count toward the cap; created via SQL role switch)
  await sql(`update app_setting set account_cap = account_cap + 1`);
  const adminCtx = await browser.newContext({ baseURL: "http://localhost:3100" });
  await createSignedInLearner(request, adminCtx, { name: "Wendy Admin", extra: "role = 'admin'" });
  await sql(`update app_setting set account_cap = account_cap - 1`);
  const admin = await adminCtx.newPage();
  await admin.goto("/admin/waitlist");
  await admin.getByRole("checkbox", { name: `Select ${VISITOR}` }).check();
  await admin.getByRole("button", { name: /invite selected/i }).click();
  await expect(admin.getByRole("cell", { name: /^invited/ })).toBeVisible();
  await adminCtx.close();

  const mails = (await (
    await request.get(`/api/e2e/outbox?to=${encodeURIComponent(VISITOR)}`)
  ).json()) as { subject: string; text: string }[];
  const invite = mails
    .find((m) => /spot is ready/i.test(m.subject))!
    .text.match(/https?:\/\/\S+/)![0]
    .replace(/[\])>.,]+$/, "");
  await page.goto(invite);
  await expect(page.getByRole("heading", { name: "Start speaking with ease." })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(VISITOR);
  await page.getByLabel("Your name").fill("Wai Ter");
  await page.getByLabel("Username").fill(`wai_${stamp % 100000}`);
  await page.getByLabel("Password").fill("waiting-pass-1");
  await page.getByRole("checkbox", { name: /16 or older/i }).check();
  await page.getByRole("button", { name: /create my free account/i }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  const [entry] = await sql<{ status: string }>(
    `select status from waitlist_entry where email = $1`,
    [VISITOR],
  );
  expect(entry!.status).toBe("registered");
});
