import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Fails on critical or serious WCAG 2.2 AA violations (SC-011, constitution VI). */
export async function expectNoA11yViolations(page: Page) {
  // Scan the settled UI: a button mid-way through its disabled→enabled opacity fade
  // otherwise reads as a contrast failure that no user ever sees at rest.
  await page.addStyleTag({
    content: "*,*::before,*::after{transition:none!important;animation:none!important}",
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(
    blocking.map(
      (v) =>
        `${v.id}: ${v.help}\n` +
        v.nodes
          .map(
            (n) =>
              `  ${n.target.join(" ")} — ${n.failureSummary?.split("\n").slice(1, 2).join("")}`,
          )
          .join("\n"),
    ),
  ).toEqual([]);
}
