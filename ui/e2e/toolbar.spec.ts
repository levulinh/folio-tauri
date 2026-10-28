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
const toolbar = (page: Page) => page.getByTestId("fmt-toolbar");
const firstLine = (page: Page) => editorOf(page).locator(".bn-inline-content").first();
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");

/** Types `text` in the first block and double-click-selects the word `word` inside it. */
async function typeAndSelect(page: Page, text: string, word: string) {
  await firstLine(page).click();
  await page.keyboard.type(text);
  await firstLine(page).getByText(word, { exact: false }).dblclick();
}

/** Selects the whole of the line the caret is on (Shift+Home from the end). */
async function selectLine(page: Page) {
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Home");
}

test("toolbar shows exactly six buttons", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  await expect(toolbar(page)).toBeVisible();
  for (const id of ["fmt-bold", "fmt-italic", "fmt-underline", "fmt-strike", "fmt-code", "fmt-link"]) {
    await expect(toolbar(page).getByTestId(id)).toBeVisible();
  }
  await expect(toolbar(page).locator("button")).toHaveCount(6);
});

test("bold button toggles and survives reload", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  await page.getByTestId("fmt-bold").click();
  await expect(firstLine(page).locator("strong")).toHaveText("chào");
  await saved(page);
  await page.reload();
  await page.getByTestId("tree-item").first().click();
  await expect(firstLine(page).locator("strong")).toHaveText("chào");
});

test("cmd b i u toggle on a selection", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  for (const [key, tag] of [["b", "strong"], ["i", "em"], ["u", "u"]] as const) {
    await page.keyboard.press(`Meta+${key}`);
    await expect(firstLine(page).locator(tag)).toHaveText("chào");
    await page.keyboard.press(`Meta+${key}`);
    await expect(firstLine(page).locator(tag)).toHaveCount(0);
  }
});

test("cmd b with no selection styles the next typed text", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("nhẹ ");
  await page.keyboard.press("Meta+b");
  await page.keyboard.type("đậm");
  await expect(firstLine(page).locator("strong")).toHaveText("đậm");
  await expect(firstLine(page)).toHaveText("nhẹ đậm");
});

async function codeBlockWith(page: Page, text: string) {
  await firstLine(page).click();
  await page.keyboard.type("``` ");
  await page.keyboard.type(text);
}

test("no toolbar in a code block", async ({ page }) => {
  await codeBlockWith(page, "let x = 1");
  await selectLine(page);
  await page.waitForTimeout(300);
  await expect(toolbar(page)).toHaveCount(0);
});

test("cmd b in a code block does nothing", async ({ page }) => {
  await codeBlockWith(page, "let x = 1");
  await selectLine(page);
  await page.keyboard.press("Meta+b");
  await page.keyboard.press("Meta+i");
  await page.keyboard.press("Meta+u");
  await expect(editorOf(page).locator("strong, em, u")).toHaveCount(0);
});

test("formatting a paragraph-plus-code selection styles only the paragraph", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("đoạn văn");
  await page.keyboard.press("Enter");
  await page.keyboard.type("``` ");
  await page.keyboard.type("let x = 1");
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Shift+Home");
  await expect(toolbar(page)).toBeVisible();
  await page.getByTestId("fmt-bold").click();
  await expect(editorOf(page).locator("strong")).toHaveText("đoạn văn");
  await expect(editorOf(page).locator(".bn-block-content[data-content-type=codeBlock] strong")).toHaveCount(0);
});

test("toolbar hides when typing", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  await expect(toolbar(page)).toBeVisible();
  await page.keyboard.type("x");
  await expect(toolbar(page)).toHaveCount(0);
});

test("focus stays in the editor", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  await page.getByTestId("fmt-bold").click();
  const inEditor = await page.evaluate(() => !!document.activeElement?.closest(".bn-editor"));
  expect(inEditor).toBe(true);
});
