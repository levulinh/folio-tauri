import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("empty-create-first").click();
  await expect(page.getByTestId("tree-item")).toHaveCount(1);
  await expect(page.getByTestId("editor")).toBeVisible();
});

const items = (page: Page) => page.getByTestId("tree-item");
const row = (page: Page) => page.getByTestId("subpage-row");

/**
 * Parent "Cha" with one paragraph and a subpage row created from the slash menu.
 * Ends on the parent page; the child is titled "Trang con".
 */
async function seed(page: Page) {
  await page.getByTestId("page-title").fill("Cha");
  await page.getByTestId("page-title").press("Enter");
  await page.keyboard.type("Mở đầu");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/subpage");
  await expect(page.getByTestId("slash-item")).toHaveText(["Subpage"]);
  await page.keyboard.press("Enter");

  // The child opens with its title focused, so the name can be typed immediately.
  await expect(page.getByTestId("page-title")).toBeFocused();
  await expect(items(page)).toHaveCount(2);
  await expect(page.getByTestId("breadcrumb-ancestor")).toHaveText("Cha");
  await page.keyboard.type("Trang con");

  await page.getByTestId("breadcrumb-ancestor").click();
  await expect(page.getByTestId("page-title")).toHaveValue("Cha");
  await expect(row(page)).toHaveText("Trang con");
  await expect(row(page)).toBeEnabled();
}

test("slash subpage creates a child page, links it in the parent and survives a reload", async ({ page }) => {
  await seed(page);
  await expect(page.getByTestId("editor")).toContainText("Mở đầu");

  // The row opens the child.
  await row(page).click();
  await expect(page.getByTestId("page-title")).toHaveValue("Trang con");

  // Keyboard activation works too and does not insert a block into the child.
  await page.getByTestId("breadcrumb-ancestor").click();
  await expect(row(page)).toBeVisible();
  await row(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("page-title")).toHaveValue("Trang con");

  // Both pages and the row are stored.
  await page.reload();
  await expect(items(page)).toHaveCount(2);
  await items(page).first().click();
  await expect(row(page)).toHaveText("Trang con");
  await row(page).click();
  await expect(page.getByTestId("page-title")).toHaveValue("Trang con");
});

test("a deleted child leaves a disabled row and keeps the parent content", async ({ page }) => {
  await seed(page);

  const child = items(page).nth(1);
  await child.hover();
  await child.getByTestId("tree-item-menu").click();
  await page.getByTestId("menu-delete").click();
  await page.getByTestId("confirm-ok").click();

  await expect(items(page)).toHaveCount(1);
  await expect(row(page)).toHaveText("Trang đã bị xoá");
  await expect(row(page)).toBeDisabled();
  await expect(page.getByTestId("editor")).toContainText("Mở đầu");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");
});

test("deleting the row keeps the page in the tree", async ({ page }) => {
  await seed(page);

  await row(page).hover();
  await expect(page.getByTestId("side-drag")).toBeVisible();
  await page.getByTestId("side-drag").click();
  await page.getByTestId("drag-menu-delete").click();

  await expect(row(page)).toHaveCount(0);
  await expect(items(page)).toHaveCount(2);

  // The page is still there and still opens.
  await items(page).nth(1).click();
  await expect(page.getByTestId("page-title")).toHaveValue("Trang con");

  // The removed row is stored as removed.
  await page.reload();
  await items(page).first().click();
  await expect(page.getByTestId("editor")).toBeVisible();
  await expect(row(page)).toHaveCount(0);
  await expect(items(page)).toHaveCount(2);
});
