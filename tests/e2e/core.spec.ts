import { expect, test, type Locator } from "@playwright/test";

/** Wait until React has attached to an element, so a click is not lost before hydration. */
async function hydrated(loc: Locator) {
  const el = loc.first();
  await el.waitFor();
  await el.evaluate((node) => new Promise<void>((resolve) => {
    const check = () => (Object.keys(node).some((k) => k.startsWith("__reactProps")) ? resolve() : setTimeout(check, 50));
    check();
  }));
  return el;
}

const count = async (t: string) => Number(t.replace(/[^\d]/g, ""));

test.describe("navigation", () => {
  test("home communicates purpose and every sidebar link resolves", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("terrain of");
    const sidebar = page.getByTestId("sidebar");
    for (const label of ["Models", "Workload finder", "Compare", "Rankings", "Benchmarks", "Ecosystem", "AI labs", "Providers", "Atlas Engine", "Methodology", "Overview"]) {
      await (await hydrated(sidebar.getByRole("link", { name: label, exact: true }))).click();
      await expect(sidebar.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
    }
  });

  test("unknown model shows not-found state", async ({ page }) => {
    await page.goto("/models/definitely-not-a-model");
    await expect(page.getByText("Off the map")).toBeVisible();
  });
});

test.describe("search", () => {
  test("keyboard shortcut opens palette, results navigate to model", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const input = page.getByTestId("search-input");
    await expect(input).toBeFocused();
    await input.fill("claude");
    await expect(page.getByRole("option").filter({ hasText: /claude/i }).first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/models\/.+/);
    await expect(page.getByTestId("model-name")).toContainText(/claude/i);
  });

  test("empty results show a helpful message and Escape closes", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("search-trigger").click();
    await page.getByTestId("search-input").fill("zzqxv-nothing");
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-input")).toHaveCount(0);
  });
});

test.describe("model discovery", () => {
  test("filters sync to URL, narrow results, and clear", async ({ page }) => {
    await page.goto("/models");
    const counter = page.getByTestId("result-count");
    const total = await count(await counter.innerText());
    expect(total).toBeGreaterThan(100);

    await (await hydrated(page.getByTestId("filter-panel").getByText("Vision", { exact: true }))).click();
    await expect(page).toHaveURL(/capability=vision/);
    await expect.poll(async () => count(await counter.innerText())).toBeLessThan(total);
    await expect(page.getByTestId("active-filters")).toContainText("Vision");

    await (await hydrated(page.getByTestId("models-search"))).fill("gemini");
    await expect(page).toHaveURL(/q=gemini/);
    await expect(page.getByTestId("model-row").first()).toContainText(/gemini/i);

    await page.getByTestId("clear-filters").click();
    await expect(page).not.toHaveURL(/capability=/);
  });

  test("sorting by input price and pagination", async ({ page }) => {
    await page.goto("/models");
    await (await hydrated(page.getByTestId("sort-select"))).selectOption("input");
    await expect(page).toHaveURL(/sort=input/);
    await expect(page.getByTestId("result-count")).not.toContainText("updating");
    await expect(page.getByTestId("model-row").first()).toBeVisible();
    await (await hydrated(page.getByTestId("next-page"))).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("model-row")).toHaveCount(24);
  });

  test("a query with no matches shows the empty state", async ({ page }) => {
    await page.goto("/models?q=zzqxv-none");
    await expect(page.getByTestId("empty-state")).toBeVisible();
  });
});

test.describe("model detail", () => {
  test("shows specs, provider table, benchmarks and explainable score", async ({ page }) => {
    await page.goto("/rankings?category=intelligence");
    await page.waitForLoadState("networkidle");
    await (await hydrated(page.getByTestId("ranking-table").getByRole("link"))).click();
    await expect(page.getByTestId("model-name")).toBeVisible();
    await expect(page.getByText("Model specification")).toBeVisible();
    await expect(page.getByTestId("offering-row").first()).toBeVisible();
    await expect(page.getByTestId("score-trace")).toContainText("Capability");
    await expect(page.getByText(/Benchmarks · \d+ published results/)).toBeVisible();
    await expect(page.getByText("Provenance")).toBeVisible();
  });
});

test.describe("comparison", () => {
  test("add from listing, persists across navigation, shareable URL, remove", async ({ page, browser }) => {
    await page.goto("/models");
    const rows = page.getByTestId("model-row");
    await (await hydrated(rows.nth(0).getByTestId("compare-toggle"))).click();
    await rows.nth(1).getByTestId("compare-toggle").click();
    await expect(page.getByTestId("compare-tray")).toBeVisible();

    await page.goto("/providers");
    await expect(page.getByTestId("compare-tray")).toContainText("2/4");

    await page.getByTestId("compare-tray").getByRole("link", { name: /Compare/ }).click();
    await expect(page).toHaveURL(/\/compare\?models=[^&]+(,|%2C)[^&]+/);
    await expect(page.getByTestId("compare-column")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Atlas Intelligence Score" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
    const shared = page.url();

    await (await hydrated(page.getByTestId("diff-toggle"))).check();
    await expect(page).toHaveURL(/diff=1/);

    await (await hydrated(page.getByTestId("compare-remove"))).click();
    await expect(page.getByTestId("compare-column")).toHaveCount(1);

    // a fresh browser context opening the shared link sees the same comparison
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await other.goto(shared);
    await expect(other.getByTestId("compare-column")).toHaveCount(2);
    await ctx.close();
  });

  test("add a model via search on the compare page", async ({ page }) => {
    await page.goto("/compare");
    await (await hydrated(page.getByTestId("compare-add"))).click();
    await page.getByTestId("compare-search").fill("llama");
    await page.getByRole("button", { name: /llama/i }).first().click();
    await expect(page.getByTestId("compare-column")).toHaveCount(1);
  });
});

test.describe("rankings, recommendations, directories", () => {
  test("ranking categories switch and label origin", async ({ page }) => {
    await page.goto("/rankings");
    await expect(page.getByText("Atlas-derived").first()).toBeVisible();
    await page.getByRole("tab", { name: /Coding/ }).click();
    await expect(page).toHaveURL(/category=coding/);
    await expect(page.getByText("External benchmark").first()).toBeVisible();
    await page.getByRole("tab", { name: /Cheapest/ }).click();
    await expect(page.getByText("Specification", { exact: true }).first()).toBeVisible();
  });

  test("custom weights re-rank and land in the URL", async ({ page }) => {
    await page.goto("/rankings");
    await (await hydrated(page.getByLabel("Cost efficiency weight"))).fill("60");
    await expect(page).toHaveURL(/weights=/);
    await expect(page.getByRole("heading", { name: "Custom Atlas ranking" })).toBeVisible();
  });

  test("workload finder explains picks and applies constraints", async ({ page }) => {
    await page.goto("/discover?workload=software-development");
    await expect(page.getByTestId("recommendation").first()).toBeVisible();
    await (await hydrated(page.getByTestId("constraints").getByRole("button", { name: "$2" }))).click();
    await expect(page).toHaveURL(/maxPrice=2/);
    await expect(page.getByTestId("recommendation").first()).toBeVisible();
  });

  test("lab and provider pages", async ({ page }) => {
    await page.goto("/labs");
    await page.waitForLoadState("networkidle");
    await (await hydrated(page.getByTestId("lab-card"))).click();
    await expect(page.getByText("Release timeline")).toBeVisible();
    await page.goto("/providers");
    await page.waitForLoadState("networkidle");
    await (await hydrated(page.getByTestId("providers-table").getByRole("link"))).click();
    await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
  });

  test("engine shows pipeline stages and job history", async ({ page }) => {
    await page.goto("/engine");
    await expect(page.getByTestId("pipeline-stage")).toHaveCount(8);
    await expect(page.getByTestId("job-list").locator("li").first()).toBeVisible();
  });
});

test.describe("theme", () => {
  test("toggle cycles theme, persists across reload and routes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);
    const toggle = page.getByTestId("theme-toggle");
    await expect(toggle).toHaveAttribute("data-theme-state", "system");
    await hydrated(toggle);
    await toggle.click(); // -> light
    await toggle.click(); // -> dark
    await expect(html).toHaveClass(/dark/);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(20, 17, 13)");
    await page.reload();
    await expect(html).toHaveClass(/dark/);
    await page.goto("/models");
    await expect(html).toHaveClass(/dark/);
  });

  test("follows system preference by default", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/benchmarks");
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test("no console errors on key pages", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  for (const p of ["/", "/models", "/rankings", "/benchmarks", "/compare", "/engine", "/ecosystem", "/discover", "/labs", "/providers"]) {
    await page.goto(p);
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});
