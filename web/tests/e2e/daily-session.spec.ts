import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";

async function record(page: Page, scope: Page | Locator = page) {
  await scope
    .getByRole("button", { name: /tap to record|record yourself/i })
    .first()
    .click();
  await page.waitForTimeout(1200); // fake mic plays the fixture clip
  await scope.getByRole("button", { name: /stop/i }).first().click();
}

test("learner completes the full daily session (US1, V1)", async ({ page }) => {
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: /today's chunk is ready/i })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: /start today's chunk/i }).click();
  await expect(page).toHaveURL(/\/practice\//);

  // Learn
  await expect(page.getByRole("heading", { name: "Today's chunk" })).toBeVisible();
  await expect(page.getByText("What it means")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Three ways to use it" })).toBeVisible();
  await expect(page.locator("ul li").filter({ hasText: /0[123]/ })).toHaveCount(3);
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: /start speaking/i }).click();

  // Speak — try 1 and try 2
  for (const tryNo of [1, 2]) {
    await expect(page.getByText(`Speak · Try ${tryNo}`)).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await record(page);
      await expect(page.getByText(/mina's tip/i)).toBeVisible({ timeout: 15_000 });
      if (tryNo === 2) await expect(page.getByText(/since try 1/i)).toBeVisible();
      // Streamed feedback: the score arrives first, then Mina's tip replaces the placeholder.
      await expect(page.getByText(/keep the rhythm smooth/i)).toBeVisible();
      await expect(page.getByText(/mina is writing a tip/i)).toHaveCount(0);
      if (i === 0 && tryNo === 1) await expectNoA11yViolations(page);
      if (i < 3) await page.getByRole("button", { name: /next recording/i }).click();
    }
    await expect(page.getByText("4/4 recorded")).toBeVisible();
    await page
      .getByRole("button", { name: tryNo === 1 ? /continue to try 2/i : /continue to writing/i })
      .click();
  }

  // Write
  await expect(page.getByRole("heading", { name: "Write three sentences." })).toBeVisible();
  for (let i = 1; i <= 3; i++) {
    await page
      .getByLabel(`Sentence ${i}`)
      .fill(`My friend explained the delay ${i}, and that makes sense.`);
  }
  await page.getByRole("button", { name: /check my sentences/i }).click();
  await expect(page.getByText(/mina's feedback/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("3/3")).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: /practice reading aloud/i }).click();

  // Read aloud
  await expect(page.getByRole("heading", { name: "Now say your sentences." })).toBeVisible();
  const cards = page.getByRole("list", { name: "Sentences to read aloud" }).getByRole("listitem");
  for (let i = 0; i < 3; i++) {
    await record(page, cards.nth(i));
    await expect(cards.nth(i).getByText(/^\d+%$/)).toBeVisible({ timeout: 15_000 });
  }
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: /see daily score/i }).click();

  // Summary
  await expect(page.getByRole("heading", { name: /that was brilliant/i })).toBeVisible();
  await expect(page.getByText(/today's score/i)).toBeVisible();
  await expect(page.getByText("1 day", { exact: true })).toBeVisible();
  await expect(page.getByText("1 day streak")).toBeVisible(); // sidebar updated too
  await expectNoA11yViolations(page);

  // Resuming /today the same day shows the finished session, not a new one.
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: /that was brilliant/i })).toBeVisible();
});
