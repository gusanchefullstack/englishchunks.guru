import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { createSignedInLearner } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });

async function logOutVia(page: Page) {
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/); // really signed out
}

test("learners can log out from the account menu on desktop", async ({
  page,
  request,
  context,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { email } = await createSignedInLearner(request, context, { name: "Ava Account" });
  await page.goto("/progress");
  await page
    .getByRole("complementary")
    .getByRole("button", { name: /account menu/i })
    .click();
  const menu = page.getByRole("menu");
  await expect(menu.getByText(email)).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Profile" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Plan & billing" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /admin console/i })).toHaveCount(0);
  await expectNoA11yViolations(page);
  await logOutVia(page);
});

test("learners can log out from the header on a phone", async ({ page, request, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createSignedInLearner(request, context, { name: "Pia Phone" });
  await page.goto("/library");
  await page
    .getByRole("banner")
    .getByRole("button", { name: /account menu/i })
    .click();
  await expect(page.getByRole("menuitem", { name: "Theme" })).toBeVisible(); // replaces the header switch
  await logOutVia(page);
});

test("admins can log out from the admin area", async ({ page, request, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await createSignedInLearner(request, context, { name: "Ada Admin", extra: "role = 'admin'" });
  await page.goto("/admin/chunks");
  await page
    .getByRole("banner")
    .getByRole("button", { name: /account menu/i })
    .click();
  await expect(
    page.getByRole("menu").getByRole("menuitem", { name: /learner app/i }),
  ).toBeVisible();
  await logOutVia(page);
});
