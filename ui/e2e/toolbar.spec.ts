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
    await page.keyboard.press(`ControlOrMeta+${key}`);
    await expect(firstLine(page).locator(tag)).toHaveText("chào");
    await page.keyboard.press(`ControlOrMeta+${key}`);
    await expect(firstLine(page).locator(tag)).toHaveCount(0);
  }
});

test("cmd b with no selection styles the next typed text", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("nhẹ ");
  await page.keyboard.press("ControlOrMeta+b");
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
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.press("ControlOrMeta+i");
  await page.keyboard.press("ControlOrMeta+u");
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

test("toolbar hidden while composing (real wiring)", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  await expect(toolbar(page)).toBeVisible();
  await page.evaluate(() => document.querySelector(".bn-editor")!.dispatchEvent(new CompositionEvent("compositionstart")));
  await expect(toolbar(page)).toHaveCount(0);
  await page.evaluate(() => document.querySelector(".bn-editor")!.dispatchEvent(new CompositionEvent("compositionend")));
  await expect(toolbar(page)).toBeVisible();
});

test("escape closes the toolbar", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  await expect(toolbar(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toolbar(page)).toHaveCount(0);
});

test("link button opens the link popover and the toolbar does not fight it", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  await page.getByTestId("fmt-link").click();
  const field = page.locator(".bn-popover-content input, .bn-form-popover input").first();
  await expect(field).toBeVisible();
  await field.fill("example.com");
  await expect(field).toHaveValue("example.com");
  await expect(toolbar(page)).toBeVisible();
  await field.press("Enter");
  await expect(firstLine(page).locator("a")).toHaveText("chào");
});

test("escape that only cancels a composition does not dismiss the toolbar", async ({ page }) => {
  // A mixed paragraph + code selection is opened by ToolbarVisibilitySync alone (BlockNote never opens it).
  await firstLine(page).click();
  await page.keyboard.type("đoạn văn");
  await page.keyboard.press("Enter");
  await page.keyboard.type("``` ");
  await page.keyboard.type("let x = 1");
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Shift+Home");
  await expect(toolbar(page)).toBeVisible();
  await page.evaluate(() => {
    const dom = document.querySelector(".bn-editor")!;
    dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true }));
  });
  // Close and reopen it through focus: a wrongly recorded dismissal would keep it closed.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await expect(toolbar(page)).toHaveCount(0);
  await page.evaluate(() => (document.querySelector(".bn-editor") as HTMLElement).focus());
  await expect(toolbar(page)).toBeVisible();
});

test("selecting the same word again after escape reopens the toolbar", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  await page.keyboard.press("Escape");
  await expect(toolbar(page)).toHaveCount(0);
  await firstLine(page).getByText("chào", { exact: false }).dblclick();
  await expect(toolbar(page)).toBeVisible();
});

test("hovering the bold button shows the Vietnamese tooltip", async ({ page }) => {
  await typeAndSelect(page, "xin chào", "chào");
  await toolbar(page).getByTestId("fmt-bold").hover();
  await expect(page.getByRole("tooltip")).toContainText("Đậm");
});

test("toolbar sync recovers after a cancelled pointer", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("xin chào");
  // A pointer that goes down in the editor and is cancelled (no pointerup) must not freeze the sync.
  await page.evaluate(() => {
    const dom = document.querySelector('[data-testid="editor"] .ProseMirror')!;
    dom.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7 }));
    dom.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 7 }));
  });
  await selectLine(page);
  await expect(toolbar(page)).toBeVisible();
});
