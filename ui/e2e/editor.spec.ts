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
const blockOf = (page: Page, type: string) => editorOf(page).locator(`.bn-block-content[data-content-type=${type}]`);
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");

async function reopen(page: Page) {
  await page.reload();
  await page.getByTestId("tree-item").first().click();
  await expect(editorOf(page)).toBeVisible();
}

test("content survives reload", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("Đà Nẵng mùa hè");
  await saved(page);
  await reopen(page);
  await expect(editorOf(page)).toContainText("Đà Nẵng mùa hè");
});

test("markdown shortcuts", async ({ page }) => {
  const cases: [string, string, string?][] = [
    ["# ", "heading", "1"],
    ["## ", "heading", "2"],
    ["### ", "heading", "3"],
    ["- ", "bulletListItem"],
    ["1. ", "numberedListItem"],
    ["[] ", "checkListItem"],
    ["> ", "quote"],
    ["``` ", "codeBlock"],
  ];
  for (const [keys, type, level] of cases) {
    await page.getByTestId("tree-item").first().click();
    await firstLine(page).click();
    await page.keyboard.press("Meta+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(keys);
    const block = blockOf(page, type);
    await expect(block, keys).toHaveCount(1);
    if (level) await expect(editorOf(page).locator(`h${level}`)).toHaveCount(1);
    // back to a paragraph for the next case
    await page.keyboard.press("Backspace");
    if (type !== "heading" && type !== "codeBlock") await page.keyboard.press("Backspace");
    await page.reload();
    await page.getByTestId("tree-item").first().click();
    await expect(editorOf(page)).toBeVisible();
  }
});

test("enter on empty list item makes paragraph", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("- một");
  await page.keyboard.press("Enter");
  await expect(blockOf(page, "bulletListItem")).toHaveCount(2);
  await page.keyboard.press("Enter");
  await expect(blockOf(page, "bulletListItem")).toHaveCount(1);
  await expect(blockOf(page, "paragraph").first()).toBeVisible();
});

test("backspace at start of heading makes paragraph", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("# tiêu đề");
  await expect(blockOf(page, "heading")).toHaveCount(1);
  await page.keyboard.press("Meta+ArrowLeft");
  await page.keyboard.press("Backspace");
  await expect(blockOf(page, "heading")).toHaveCount(0);
  await expect(editorOf(page)).toContainText("tiêu đề");
});

test("nesting survives reload", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("- cha");
  await page.keyboard.press("Enter");
  await page.keyboard.type("con");
  await page.keyboard.press("Tab");
  await expect(editorOf(page).locator(".bn-block-group .bn-block-group")).toHaveCount(1);
  await saved(page);
  await reopen(page);
  await expect(editorOf(page).locator(".bn-block-group .bn-block-group")).toHaveCount(1);
  await expect(editorOf(page).locator(".bn-block-group .bn-block-group")).toContainText("con");
});

test("leaving a page right after typing keeps the text", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("vừa gõ xong");
  await page.getByTestId("sidebar-new-page").click(); // opens a second page immediately
  await expect(page.getByTestId("tree-item")).toHaveCount(2);
  await page.getByTestId("tree-item").first().click();
  await expect(editorOf(page)).toContainText("vừa gõ xong");
  await saved(page);
  await reopen(page);
  await expect(editorOf(page)).toContainText("vừa gõ xong");
});
