import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("empty-create-first").click();
  await expect(page.getByTestId("tree-item")).toHaveCount(1);
  await expect(page.getByTestId("editor")).toBeVisible();
});

const editorOf = (page: Page) => page.getByTestId("editor");
const firstLine = (page: Page) => editorOf(page).locator(".bn-inline-content").first();
const menu = (page: Page) => page.getByTestId("slash-menu");
const items = (page: Page) => page.getByTestId("slash-item");
const blocks = (page: Page) => editorOf(page).locator(".bn-block-content");

const TITLES = [
  "Text", "Heading 1", "Heading 2", "Heading 3", "Bulleted list",
  "Numbered list", "To-do list", "Quote", "Code", "Table",
];

test("slash opens the menu with English labels", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/");
  await expect(menu(page)).toBeVisible();
  await expect(items(page)).toHaveText(TITLES);
});

test("typing `:smile` opens no emoji grid menu (the picker is disabled)", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type(":smile");
  await expect(page.locator(".bn-grid-suggestion-menu")).toHaveCount(0);
  await expect(page.locator(".bn-suggestion-menu")).toHaveCount(0);
  await expect(firstLine(page)).toHaveText(":smile");
});

test("typing filters", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/head");
  await expect(items(page)).toHaveCount(3);
  await expect(items(page)).toHaveText(["Heading 1", "Heading 2", "Heading 3"]);
});

test("enter applies to an empty block", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/h2");
  await expect(items(page)).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(menu(page)).toHaveCount(0);
  await expect(blocks(page).first()).toHaveAttribute("data-content-type", "heading");
  await expect(blocks(page).first()).toHaveAttribute("data-level", "2");
  await expect(firstLine(page)).toHaveText("");
  await page.keyboard.type("Tiêu đề");
  await expect(firstLine(page)).toHaveText("Tiêu đề");
});

test("arrow keys move the selection and enter applies it", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/");
  await expect(items(page)).toHaveCount(10);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(blocks(page).first()).toHaveAttribute("data-level", "2");
});

test("click applies", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/");
  await page.locator('[data-testid=slash-item][data-key=quote]').click();
  await expect(blocks(page).first()).toHaveAttribute("data-content-type", "quote");
  await expect(menu(page)).toHaveCount(0);
});

test("slash at end of non-empty block inserts below and removes the query", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("xin chào /todo");
  await page.keyboard.press("Enter");
  await expect(blocks(page).first()).toHaveAttribute("data-content-type", "paragraph");
  await expect(firstLine(page)).toHaveText("xin chào");
  await expect(blocks(page).nth(1)).toHaveAttribute("data-content-type", "checkListItem");
  await page.keyboard.type("việc");
  await expect(editorOf(page).locator(".bn-inline-content").nth(1)).toHaveText("việc");
});

test("escape closes and keeps the slash text", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/he");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(firstLine(page)).toHaveText("/he");
});

test("backspacing the slash closes", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Backspace");
  await expect(menu(page)).toHaveCount(0);
  await expect(firstLine(page)).toHaveText("");
});

test("no menu in a code block", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/code");
  await page.keyboard.press("Enter");
  await expect(blocks(page).first()).toHaveAttribute("data-content-type", "codeBlock");
  await page.keyboard.type("a /");
  await expect(editorOf(page).locator("code").first()).toContainText("a /");
  await expect(menu(page)).toHaveCount(0);
});

test("slash in the middle of text opens the menu", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("abc");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type("/");
  await expect(menu(page)).toBeVisible();
});

test("table item inserts a table (BlockNote default: 2 rows x 3 columns)", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/table");
  await page.keyboard.press("Enter");
  const table = editorOf(page).locator("table");
  await expect(table).toBeVisible();
  await expect(table.locator("tr")).toHaveCount(2);
  await expect(table.locator("tr").first().locator("th, td")).toHaveCount(3);
});

test("a slash typed after compositionstart still lands as text (smoke; the guard is covered in Vitest)", async ({ page }) => {
  await firstLine(page).click();
  await editorOf(page).locator(".bn-editor").dispatchEvent("compositionstart");
  await page.keyboard.type("/");
  await expect(firstLine(page)).toHaveText("/");
  await expect(menu(page)).toHaveCount(0);
});

test("no slash menu in a table cell", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("/table");
  await page.keyboard.press("Enter");
  const cell = editorOf(page).locator("table td, table th").first();
  await cell.click();
  await page.keyboard.type("/");
  await expect(cell).toContainText("/");
  await expect(menu(page)).toHaveCount(0);
});
