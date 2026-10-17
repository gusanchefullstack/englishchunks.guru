import { expect, test, type Locator } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const style = (el: Locator, prop: "backgroundColor" | "cursor" | "textDecorationThickness") =>
  el.evaluate((node, p) => getComputedStyle(node)[p], prop);

// Every clickable surface shows it is clickable: pointer cursor + a visible hover state.
test("buttons and links show hover feedback", async ({ page }) => {
  await page.goto("/sign-in");
  const main = page.getByRole("main");

  for (const name of ["Log in", "Continue with Google", "Back to home"]) {
    const button = main.getByRole(name === "Back to home" ? "link" : "button", { name });
    await page.mouse.move(0, 0);
    const before = await style(button, "backgroundColor");
    expect(await style(button, "cursor"), name).toBe("pointer");
    await button.hover();
    await expect.poll(() => style(button, "backgroundColor"), { message: name }).not.toBe(before);
  }

  const link = main.getByRole("link", { name: "Start free" });
  await page.mouse.move(0, 0);
  const thin = await style(link, "textDecorationThickness");
  await link.hover();
  await expect.poll(() => style(link, "textDecorationThickness")).not.toBe(thin);
});
