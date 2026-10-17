import { expect, test, type APIRequestContext } from "@playwright/test";
import pg from "pg";
import { expectNoA11yViolations } from "./helpers/axe";

test.use({ storageState: { cookies: [], origins: [] } });

const E2E_DB =
  process.env.E2E_DATABASE_URL ?? "postgres://postgres:dev@localhost:54329/englishchunks";
const stamp = Date.now();
const NEW = {
  name: "Sofia Kim",
  username: `sofia_${stamp % 100000}`,
  email: `sofia.${stamp}@e2e.test`,
  password: "first-password-1",
};

async function lastLink(request: APIRequestContext, to: string, subject: RegExp) {
  await expect
    .poll(async () =>
      (
        (await (await request.get(`/api/e2e/outbox?to=${encodeURIComponent(to)}`)).json()) as {
          subject: string;
        }[]
      ).some((m) => subject.test(m.subject)),
    )
    .toBe(true);
  const mails = (await (
    await request.get(`/api/e2e/outbox?to=${encodeURIComponent(to)}`)
  ).json()) as { subject: string; text: string }[];
  const mail = mails.filter((m) => subject.test(m.subject)).at(-1)!;
  return mail.text.match(/https?:\/\/\S+/)![0].replace(/[\])>.,]+$/, "");
}

test.afterAll(async () => {
  const c = new pg.Client({ connectionString: E2E_DB });
  await c.connect();
  await c.query(`delete from "user" where email = $1`, [NEW.email]);
  await c.end();
});

test("sign up → verify → level → about → profile → reset password (US2, V4–V5)", async ({
  page,
  request,
}) => {
  // Sign up — age confirmation is required (FR-007)
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Start speaking with ease." })).toBeVisible();
  await expectNoA11yViolations(page);
  const submit = page.getByRole("button", { name: /create my free account/i });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Your name").fill(NEW.name);
  await page.getByLabel("Username").fill(NEW.username);
  await page.getByLabel("Email address").fill(NEW.email);
  await page.getByLabel("Password").fill(NEW.password);
  await page.getByRole("checkbox", { name: /16 or older/i }).check();
  await submit.click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expectNoA11yViolations(page);

  // Verify via the emailed link → onboarding
  await page.goto(await lastLink(request, NEW.email, /confirm your email/i));
  await expect(page).toHaveURL(/\/onboarding\/level/);
  await expect(page.getByRole("heading", { name: /where are you/i })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByText("Upper intermediate").click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2
  await expect(page.getByRole("heading", { name: /tell us a little about you/i })).toBeVisible();
  await page.getByLabel("Mother tongue").selectOption("ko");
  await page.getByLabel("Daily reminder").selectOption("8");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: /build my learning plan/i }).click();
  await expect(page.getByRole("heading", { name: /today's chunk is ready/i })).toBeVisible();

  // Profile edits persist
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile & preferences" })).toBeVisible();
  await expect(page.getByText("B2 · Upper intermediate").first()).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByLabel("Audio voice").selectOption({ label: "Leo · Friendly" });
  await expect(page.getByText("Saved").first()).toBeVisible();
  await page.getByLabel("Show me in the public ranking").click();
  await page.reload();
  await expect(page.getByLabel("Audio voice")).toHaveValue("us-leo-friendly");
  await expect(page.getByLabel("Show me in the public ranking")).not.toBeChecked();
  await expect(page.getByLabel("Mother tongue")).toHaveValue("ko");

  // Log out, reset password with a single-use link, log in with the new password
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole("link", { name: /forgot your password/i }).click();
  await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  await page.getByLabel("Email address").fill(NEW.email);
  await page.getByRole("button", { name: /send the link/i }).click();
  await expect(page.getByText(/link is on its way/i)).toBeVisible();
  const resetLink = await lastLink(request, NEW.email, /reset your/i);
  await page.goto(resetLink);
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByLabel("New password", { exact: true }).fill("second-password-2");
  await page.getByLabel("Repeat the new password").fill("second-password-2");
  await page.getByRole("button", { name: /save my new password/i }).click();
  await expect(page.getByText(/your password was changed/i)).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByLabel("Email address").fill(NEW.email);
  await page.getByLabel("Password").fill("second-password-2");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/today/);

  // The reset link is single-use
  await page.goto(resetLink);
  await expect(page.getByRole("heading", { name: /expired/i })).toBeVisible();
});

test("sign-up without age confirmation is refused by the server too (V5)", async ({ request }) => {
  const res = await request.post("/api/auth/sign-up/email", {
    data: {
      name: "No Age",
      username: `noage_${stamp % 100000}`,
      email: `noage.${stamp}@e2e.test`,
      password: "whatever-pass-1",
    },
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toMatch(/16 or older/);
});
