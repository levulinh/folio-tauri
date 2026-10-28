import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const items = (page: Page) => page.getByTestId("tree-item");

async function createFirst(page: Page) {
  await page.getByTestId("empty-create-first").click();
  await expect(items(page)).toHaveCount(1);
}

test("empty state creates first page", async ({ page }) => {
  await expect(page.getByTestId("empty-create-first")).toBeVisible();
  await createFirst(page);
  await expect(page.getByTestId("empty-create-first")).toHaveCount(0);
});

test("create subpage", async ({ page }) => {
  await createFirst(page);
  await items(page).first().hover();
  await page.getByTestId("tree-item-add-child").first().click();
  await expect(items(page)).toHaveCount(2);
  const [parent, child] = [items(page).nth(0), items(page).nth(1)];
  const parentId = await parent.getAttribute("data-page-id");
  expect(parentId).toBeTruthy();
  expect(await child.getAttribute("data-page-id")).not.toBe(parentId);
  const titleX = async (l: typeof parent) => (await l.getByTestId("tree-item-title").boundingBox())!.x;
  expect(await titleX(child)).toBeGreaterThan(await titleX(parent));
});

test("rename", async ({ page }) => {
  await createFirst(page);
  await items(page).first().hover();
  await page.getByTestId("tree-item-menu").click();
  await page.getByTestId("menu-rename").click();
  await page.keyboard.type("Ghi chú 😀");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("tree-item-title").first()).toHaveText("Ghi chú 😀");
  await expect(page.getByTestId("page-title")).toHaveText("Ghi chú 😀");
});

test("rename: Escape cancels", async ({ page }) => {
  await createFirst(page);
  await items(page).first().hover();
  await page.getByTestId("tree-item-menu").click();
  await page.getByTestId("menu-rename").click();
  await page.keyboard.type("bỏ đi");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tree-item-title").first()).toHaveText("Không có tiêu đề");
});

test("delete asks and removes subtree", async ({ page }) => {
  await createFirst(page);
  await items(page).first().hover();
  await page.getByTestId("tree-item-add-child").first().click();
  await expect(items(page)).toHaveCount(2);

  await items(page).first().hover();
  await page.getByTestId("tree-item-menu").first().click();
  await page.getByTestId("menu-delete").click();
  await expect(page.getByRole("alertdialog")).toContainText("và 1 trang con");
  await page.getByTestId("confirm-cancel").click();
  await expect(items(page)).toHaveCount(2);

  await items(page).first().hover();
  await page.getByTestId("tree-item-menu").first().click();
  await page.getByTestId("menu-delete").click();
  await page.getByTestId("confirm-ok").click();
  await expect(items(page)).toHaveCount(0);
  await expect(page.getByTestId("empty-create-first")).toBeVisible();
});

test("untitled shows placeholder", async ({ page }) => {
  await createFirst(page);
  await expect(page.getByTestId("tree-item-title").first()).toHaveText("Không có tiêu đề");
  await expect(page.getByTestId("page-title")).toHaveText("Không có tiêu đề");
});

test("sidebar button and native menu event create pages", async ({ page }) => {
  await createFirst(page);
  await page.getByTestId("sidebar-new-page").click();
  await expect(items(page)).toHaveCount(2);
  await page.evaluate(() => window.__folioFake!.emitMenu("new-page"));
  await expect(items(page)).toHaveCount(3);
  // a page is open now, so new-subpage adds a child
  await page.evaluate(() => window.__folioFake!.emitMenu("new-subpage"));
  await expect(items(page)).toHaveCount(4);
});

test("new-subpage does nothing when no page is open", async ({ page }) => {
  await page.evaluate(() => window.__folioFake!.emitMenu("new-subpage"));
  await page.waitForTimeout(200);
  await expect(page.getByTestId("empty-create-first")).toBeVisible();
  expect(await page.evaluate(() => window.__folioFake!.pagesList())).toEqual([]);
});

test("expanded state survives a reload", async ({ page }) => {
  await createFirst(page);
  await items(page).first().hover();
  await page.getByTestId("tree-item-add-child").first().click();
  await expect(items(page)).toHaveCount(2);
  await page.reload();
  await expect(items(page)).toHaveCount(2);
  await page.getByTestId("tree-item-toggle").first().click();
  await expect(items(page)).toHaveCount(1);
  await page.reload();
  await expect(items(page)).toHaveCount(1);
});

async function renameFirst(page: Page, title: string) {
  await items(page).first().hover();
  await page.getByTestId("tree-item-menu").first().click();
  await page.getByTestId("menu-rename").click();
  await page.getByTestId("tree-item-rename").fill(title);
  await page.keyboard.press("Enter");
}
const storedTitles = (page: Page) =>
  page.evaluate(async () => (await window.__folioFake!.pagesList()).map((p) => p.title));

for (const title of ["   ", " a ", "Ghi chú 😀", "x".repeat(500)]) {
  test(`title round-trips exactly: ${JSON.stringify(title.slice(0, 12))} (${title.length})`, async ({ page }) => {
    await createFirst(page);
    await renameFirst(page, title);
    await expect.poll(() => storedTitles(page)).toEqual([title]);
    await page.reload();
    const shown = await page.getByTestId("tree-item-title").first().textContent();
    expect(shown).toBe(title);
  });
}

test("untitled placeholder only for the empty string", async ({ page }) => {
  await createFirst(page);
  await renameFirst(page, "abc");
  await expect.poll(() => storedTitles(page)).toEqual(["abc"]);
  await renameFirst(page, "");
  await expect.poll(() => storedTitles(page)).toEqual([""]);
  await expect(page.getByTestId("tree-item-title").first()).toHaveText("Không có tiêu đề");
});

test("long title stays on one line and keeps its buttons usable", async ({ page }) => {
  await createFirst(page);
  await renameFirst(page, "y".repeat(500));
  const row = items(page).first();
  await row.hover();
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(30);
  const add = page.getByTestId("tree-item-add-child").first();
  const menu = page.getByTestId("tree-item-menu").first();
  await expect(add).toBeVisible();
  await expect(menu).toBeVisible();
  const sidebarRight = (await page.locator("aside").boundingBox())!.width;
  expect((await menu.boundingBox())!.x + (await menu.boundingBox())!.width).toBeLessThanOrEqual(sidebarRight);
  await add.click();
  await expect(items(page)).toHaveCount(2);
});

test("clicking the menu trigger again closes the menu", async ({ page }) => {
  await createFirst(page);
  await items(page).first().hover();
  await page.getByTestId("tree-item-menu").click();
  await expect(page.getByTestId("menu-rename")).toBeVisible();
  await page.getByTestId("tree-item-menu").click();
  await expect(page.getByTestId("menu-rename")).toHaveCount(0);
});
