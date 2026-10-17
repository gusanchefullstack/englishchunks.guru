import { expect, test } from "@playwright/test";
import { createSignedInLearner } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });

// Regression: the Speak step reuses one PlayButton across items, and it kept replaying the
// first audio it loaded (the chunk) when the learner moved to an example.
test("'Hear it first' plays the audio of the item on screen", async ({ page, request, context }) => {
  await createSignedInLearner(request, context, { name: "Hana Listener" });
  await page.goto("/today");
  await page.getByRole("button", { name: /start today's chunk/i }).click();
  await page.getByRole("button", { name: /start speaking/i }).click();
  await expect(page.getByText("Speak · Try 1")).toBeVisible();

  const hear = page.getByRole("button", { name: "Hear it first" });
  const ttsRef = async () => {
    const req = page.waitForRequest((r) => r.url().includes("/api/tts?ref="));
    await hear.click();
    return new URL((await req).url()).searchParams.get("ref");
  };

  expect(await ttsRef()).toMatch(/^chunk:/);
  await page.getByRole("button", { name: "Next item" }).click();
  await expect(page.getByText("Example 1 · 2 of 4")).toBeVisible();
  const first = await ttsRef();
  expect(first).toMatch(/^example:/);
  await page.getByRole("button", { name: "Next item" }).click();
  const second = await ttsRef();
  expect(second).toMatch(/^example:/);
  expect(second).not.toBe(first);
});
