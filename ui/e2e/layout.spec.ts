import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("empty-create-first").click();
  await expect(page.getByTestId("tree-item")).toHaveCount(1);
  await expect(page.getByTestId("editor")).toBeVisible();
  await page.getByTestId("editor").locator(".bn-inline-content").first().click();
  await page.keyboard.type("Một đoạn văn");
});

const TRANSPARENT = "rgba(0, 0, 0, 0)";
const titleBox = async (page: Page) => (await page.getByTestId("page-title").boundingBox())!;
const mainBox = async (page: Page) => (await page.locator("main").boundingBox())!;

for (const scheme of ["light", "dark"] as const) {
  test(`editor has no own background (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const bg = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const pageBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    for (const sel of [".bn-editor", ".bn-container"]) {
      const value = await bg(sel);
      expect([TRANSPARENT, pageBg]).toContain(value);
    }
  });
}

test("text aligns with the title", async ({ page }) => {
  const text = await page.getByTestId("editor").locator(".bn-inline-content").first().boundingBox();
  expect(Math.abs((await titleBox(page)).x - text!.x)).toBeLessThanOrEqual(2);
});

test("column is 900px on a wide window", async ({ page }) => {
  expect(Math.abs((await titleBox(page)).width - 900)).toBeLessThanOrEqual(1);
});

test("column shrinks on a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(noScroll).toBe(true);
  const main = await mainBox(page);
  expect(Math.abs((await titleBox(page)).width - (main.width - 144))).toBeLessThanOrEqual(1);
});

test("side menu fits in the gutter", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.getByTestId("editor").locator(".bn-block-content").first().hover();
  const menu = page.locator(".bn-side-menu").first();
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual((await mainBox(page)).x);
});
