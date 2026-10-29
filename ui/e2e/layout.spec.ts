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


test("shell dimensions, typography and minimum viewport remain usable", async ({ page }) => {
  const aside = page.locator("aside");
  expect((await aside.boundingBox())!.width).toBe(248);
  const strips = page.locator("[data-tauri-drag-region]");
  await expect(strips).toHaveCount(2);
  for (const strip of await strips.all()) expect((await strip.boundingBox())!.height).toBe(28);
  const header = page.getByTestId("page-header");
  await expect(header).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveCount(1);
  const title = page.getByTestId("page-title");
  const style = await title.evaluate((el) => { const s = getComputedStyle(el); return { size: s.fontSize, weight: s.fontWeight, line: s.lineHeight }; });
  expect(style).toEqual({ size: "40px", weight: "650", line: "48px" });
  expect((await title.boundingBox())!.y - ((await header.boundingBox())!.y + (await header.boundingBox())!.height)).toBeCloseTo(35, 0);
  await page.setViewportSize({ width: 800, height: 500 });
  const main = await mainBox(page);
  const box = (await title.boundingBox())!;
  const text = (await page.getByTestId("editor").locator(".bn-inline-content").first().boundingBox())!;
  expect(Math.abs(box.x - text.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.x - main.x - 72)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.width - (main.width - 144))).toBeLessThanOrEqual(1);
  expect(await page.locator("main").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.getByTestId("open-settings")).toBeInViewport();
});

test("long titles and deep tree keep breadcrumb and row actions usable", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 });
  const longTitle = "Long title ".repeat(50).slice(0, 500);
  await page.getByTestId("page-title").fill(longTitle);
  await page.getByTestId("page-title").blur();
  await expect(page.getByTestId("tree-item-title").first()).toHaveText(longTitle);
  for (let depth = 0; depth < 12; depth++) {
    const item = page.getByTestId("tree-item").last();
    await item.hover();
    await item.getByTestId("tree-item-add-child").click();
    await expect(page.getByTestId("tree-item")).toHaveCount(depth + 2);
  }
  const last = page.getByTestId("tree-item").last();
  await last.hover();
  const actions = last.getByTestId("tree-item-menu");
  const a = (await actions.boundingBox())!;
  const side = (await page.locator("aside").boundingBox())!;
  expect(a.x + a.width).toBeLessThanOrEqual(side.x + side.width);
  await actions.click();
  await page.getByTestId("menu-rename").click();
  await expect(last.getByTestId("tree-item-rename")).toBeFocused();
  const breadcrumb = page.getByTestId("page-breadcrumb");
  await expect(breadcrumb).toContainText(longTitle);
  await expect(breadcrumb).toContainText("Không có tiêu đề");
  await expect(page.getByTestId("save-status")).toBeVisible();
  expect(await page.locator("main").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});
