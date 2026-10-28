import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("empty-create-first").click();
  await expect(page.getByTestId("tree-item")).toHaveCount(1);
});

test("editor shows and accepts typing", async ({ page }) => {
  const editor = page.getByTestId("editor");
  await expect(editor).toBeVisible();
  await editor.locator(".bn-inline-content").first().click();
  await page.keyboard.type("Xin chào Folio");
  await expect(editor).toContainText("Xin chào Folio");
});

test("typing in the title updates the sidebar after the debounce", async ({ page }) => {
  await page.getByTestId("page-title").fill("Sổ tay");
  await expect(page.getByTestId("tree-item-title").first()).toHaveText("Sổ tay");
});

test("Enter in the title focuses the editor", async ({ page }) => {
  await expect(page.getByTestId("editor")).toBeVisible();
  await page.getByTestId("page-title").click();
  await page.keyboard.press("Enter");
  await page.keyboard.type("nội dung");
  await expect(page.getByTestId("editor")).toContainText("nội dung");
  await expect(page.getByTestId("page-title")).toHaveValue("");
});

test("markdown shortcut # makes a heading", async ({ page }) => {
  const editor = page.getByTestId("editor");
  await editor.locator(".bn-inline-content").first().click();
  await page.keyboard.type("# Tiêu đề lớn");
  await expect(editor.locator("h1")).toContainText("Tiêu đề lớn");
});
