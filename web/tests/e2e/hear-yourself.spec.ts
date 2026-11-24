import { expect, test } from "@playwright/test";
import { createSignedInLearner } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });

// FR-075: the learner replays their own latest recording from memory, beside the guide audio.
test("'Hear yourself' replays the recording on the device only", async ({
  page,
  request,
  context,
}) => {
  await createSignedInLearner(request, context, { name: "Rita Replay" });
  // Note which source each <audio> play() call used.
  await page.addInitScript(() => {
    const played: string[] = [];
    (window as unknown as { __played: string[] }).__played = played;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      played.push(this.currentSrc || this.src);
      return original.call(this);
    };
  });
  await page.goto("/today");
  await page.getByRole("button", { name: /start today's chunk/i }).click();
  await page.getByRole("button", { name: /start speaking/i }).click();
  await expect(page.getByText("Speak · Try 1")).toBeVisible();

  // Nothing to replay before recording.
  await expect(page.getByRole("button", { name: "Hear it first" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hear yourself" })).toHaveCount(0);

  await page.getByRole("button", { name: /tap to record/i }).click();
  await page.waitForTimeout(1200); // fake mic plays the fixture clip
  await page.getByRole("button", { name: /stop/i }).click();
  await expect(page.getByText(/mina's tip/i)).toBeVisible({ timeout: 15_000 });

  const hearYourself = page.getByRole("button", { name: "Hear yourself" });
  await expect(hearYourself).toBeVisible();
  await expect(page.getByRole("button", { name: "Hear the guide" })).toBeVisible();

  // Replay comes from memory: a blob: URL, and no request leaves the page.
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await hearYourself.click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __played: string[] }).__played))
    .toEqual([expect.stringMatching(/^blob:/)]);
  expect(requests.filter((u) => new URL(u).pathname.startsWith("/api/"))).toEqual([]);

  // Each item keeps its own clip.
  await page.getByRole("button", { name: "Next item" }).click();
  await expect(page.getByText("Example 1 · 2 of 4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hear yourself" })).toHaveCount(0);
  await page.getByRole("button", { name: "Previous item" }).click();
  await expect(page.getByRole("button", { name: "Hear yourself" })).toBeVisible();

  // Leaving the page discards it: after a reload the score is back, the clip is not.
  await page.reload();
  await expect(page.getByText("Speak · Try 1")).toBeVisible();
  if (await page.getByText("Example 1 · 2 of 4").isVisible())
    await page.getByRole("button", { name: "Previous item" }).click();
  await expect(page.getByText(/your score:/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Hear yourself" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hear it first" })).toBeVisible();

  // Finishing the step releases the clips: try 2 starts with nothing to replay.
  for (let i = 1; i < 4; i++) {
    await page.getByRole("button", { name: "Next item" }).click();
    await page.getByRole("button", { name: /tap to record/i }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /stop/i }).click();
    await expect(page.getByText(/mina's tip/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Hear yourself" })).toBeVisible();
  }
  await page.getByRole("button", { name: /continue to try 2/i }).click();
  await expect(page.getByText("Speak · Try 2")).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await expect(page.getByRole("button", { name: "Hear yourself" })).toHaveCount(0);
    if (i < 3) await page.getByRole("button", { name: "Next item" }).click();
  }
});
