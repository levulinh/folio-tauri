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
    await expect(page.locator(".bn-container")).toHaveAttribute("data-color-scheme", scheme);
    for (const sel of [".bn-editor", ".bn-container"]) {
      const value = await page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(value).toBe(TRANSPARENT);
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
  const m = await page.locator("main").evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(m.scroll).toBeLessThanOrEqual(m.client);
  const doc = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(doc).toBe(true);
  expect(Math.abs((await titleBox(page)).width - (m.client - 144))).toBeLessThanOrEqual(1);
});

test("side menu fits in the gutter", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  const block = page.getByTestId("editor").locator(".bn-block-content").first();
  await block.hover();
  const menu = page.locator(".bn-side-menu").first();
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  const text = (await block.locator(".bn-inline-content").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual((await mainBox(page)).x);
  expect(box.x + box.width).toBeLessThanOrEqual(text.x);
});

for (const scheme of ["light", "dark"] as const) {
  test(`title input shows a visible focus indicator (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const title = page.getByTestId("page-title");
    await page.locator("aside").click({ position: { x: 5, y: 400 } }); // title not focused
    await expect(title).not.toBeFocused();
    const ring = () => title.evaluate((el) => getComputedStyle(el).boxShadow);
    const idle = await ring();
    await title.focus();
    await expect(title).toBeFocused();
    const focused = await ring();
    expect(focused).not.toBe(idle);
    expect(focused).not.toBe("none");
  });
}
