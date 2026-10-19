import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/axe";
import { createSignedInLearner } from "./helpers/users";

test.use({ storageState: { cookies: [], origins: [] } });

// Regression: the panel read the recorder's state from before the tap, so a blocked microphone
// never offered "Skip speaking today". The block is also reported for diagnostics (FR-074).
test("a blocked microphone offers to skip speaking and is reported", async ({
  page,
  request,
  context,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  await createSignedInLearner(request, context, { name: "Mia Muted" });
  await page.goto("/today");
  await page.getByRole("button", { name: /start today's chunk/i }).click();
  await page.getByRole("button", { name: /start speaking/i }).click();
  await expect(page.getByText("Speak · Try 1")).toBeVisible();

  const report = page.waitForRequest(
    (r) => r.url().endsWith("/api/events") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Tap to record" }).click();
  const sent = await report;
  expect(sent.postDataJSON()).toMatchObject({
    kind: "mic_denied",
    step: "speak_1",
    reason: "NotAllowedError",
  });
  expect((await sent.response())?.status()).toBe(204);

  await expect(page.getByText(/can't use your microphone/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip speaking today" })).toBeVisible();
  await expectNoA11yViolations(page);
});
