import { expect, test, type Locator, type Page } from "@playwright/test";
import { createSignedInLearner, sql } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });
const cleanup = () =>
  sql(`delete from "user" where name = 'Kim Keyboard' and email like '%@e2e.test'`);
test.beforeAll(cleanup);
test.afterAll(cleanup);

/** Tab forward until `target` has focus (fails if it's unreachable by keyboard). */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`not reachable by Tab: ${target}`);
}

async function keyboardRecord(page: Page, scope: Page | Locator = page) {
  const rec = scope.getByRole("button", { name: /tap to record|record yourself/i }).first();
  await tabTo(page, rec);
  await page.keyboard.press("Space");
  await page.waitForTimeout(1200);
  const stop = scope.getByRole("button", { name: /stop/i }).first();
  await expect(stop).toBeFocused(); // focus stays on the toggled control
  await page.keyboard.press("Space");
}

test("the whole daily session works with the keyboard only (SC-011)", async ({
  page,
  request,
  context,
}) => {
  await createSignedInLearner(request, context, { name: "Kim Keyboard" });
  await page.goto("/today");

  // Skip link is the first stop and moves focus to main content.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  await tabTo(page, page.getByRole("button", { name: /start today's chunk/i }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/practice\//);

  // Learn → Speak
  await tabTo(page, page.getByRole("button", { name: /start speaking/i }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("Speak · Try 1")).toBeVisible();

  for (const tryNo of [1, 2]) {
    await expect(page.getByText(`Speak · Try ${tryNo}`)).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await keyboardRecord(page);
      await expect(page.getByText(/mina's tip/i)).toBeVisible({ timeout: 15_000 });
      if (i < 3) {
        await tabTo(page, page.getByRole("button", { name: /next recording/i }));
        await page.keyboard.press("Enter");
      }
    }
    await tabTo(
      page,
      page.getByRole("button", {
        name: tryNo === 1 ? /continue to try 2/i : /continue to writing/i,
      }),
    );
    await page.keyboard.press("Enter");
  }

  // Write: type into each field reached by Tab
  await expect(page.getByRole("heading", { name: "Write three sentences." })).toBeVisible();
  for (let i = 1; i <= 3; i++) {
    await tabTo(page, page.getByLabel(`Sentence ${i}`));
    await page.keyboard.type(`My friend explained it ${i}, and that makes sense.`);
  }
  await tabTo(page, page.getByRole("button", { name: /check my sentences/i }));
  await page.keyboard.press("Enter");
  await expect(page.getByText(/mina's feedback/i)).toBeVisible({ timeout: 15_000 });
  await tabTo(page, page.getByRole("button", { name: /practice reading aloud/i }));
  await page.keyboard.press("Enter");

  // Read aloud
  const cards = page.getByRole("list", { name: "Sentences to read aloud" }).getByRole("listitem");
  for (let i = 0; i < 3; i++) {
    await keyboardRecord(page, cards.nth(i));
    await expect(cards.nth(i).getByText(/^\d+%$/)).toBeVisible({ timeout: 15_000 });
  }
  await tabTo(page, page.getByRole("button", { name: /see daily score/i }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /that was brilliant/i })).toBeVisible();
});

test("focus is always visible", async ({ page, request, context }) => {
  await createSignedInLearner(request, context, { name: "Kim Keyboard" });
  await page.goto("/library");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "none";
      const cs = getComputedStyle(el);
      return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0
        ? "ok"
        : cs.boxShadow !== "none"
          ? "ok"
          : `missing on ${el.tagName} ${el.textContent?.slice(0, 30)}`;
    });
    expect(outline).toBe("ok");
  }
});
