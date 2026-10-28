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
