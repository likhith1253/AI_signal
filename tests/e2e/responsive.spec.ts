import { expect, test, type Locator } from "@playwright/test";

async function hydrated(loc: Locator) {
  const el = loc.first();
  await el.waitFor();
  await el.evaluate((node) => new Promise<void>((resolve) => {
    const check = () => (Object.keys(node).some((k) => k.startsWith("__reactProps")) ? resolve() : setTimeout(check, 50));
    check();
  }));
  return el;
}

const horizontalOverflow = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("mobile layout", () => {
  test("drawer navigation replaces the sidebar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("sidebar")).toBeHidden();
    await (await hydrated(page.getByTestId("mobile-menu"))).click();
    const drawer = page.getByTestId("mobile-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Rankings" }).click();
    await expect(page).toHaveURL(/\/rankings/);
    await expect(drawer).toBeHidden();
  });

  test("filters open as a bottom sheet; no horizontal scroll", async ({ page }) => {
    await page.goto("/models");
    await (await hydrated(page.getByTestId("mobile-filters"))).click();
    await page.getByText("Tool calling", { exact: true }).last().click();
    await expect(page).toHaveURL(/capability=tools/);
    await page.getByRole("button", { name: "Show results" }).click();
    await expect(page.getByTestId("model-row").first()).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("key pages fit the viewport", async ({ page }) => {
    for (const p of ["/", "/rankings", "/engine", "/providers", "/discover"]) {
      await page.goto(p);
      expect(await horizontalOverflow(page), p).toBeLessThanOrEqual(1);
    }
    await page.goto("/rankings?category=intelligence");
    await page.waitForLoadState("networkidle");
    await (await hydrated(page.getByTestId("ranking-table").getByRole("link"))).click();
    await expect(page.getByTestId("model-name")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
