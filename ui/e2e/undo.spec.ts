import { expect, test, type Page } from "@playwright/test";
import { SAVE_DEBOUNCE_MS } from "../src/editor/saveTiming";

const GROUPS = ["Một", "Hai", "Ba"];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("empty-create-first").click();
  await expect(page.getByTestId("editor")).toBeVisible();
  // Three typing groups, far enough apart to be three native/ProseMirror undo steps.
  await page.getByTestId("editor").locator(".bn-inline-content").first().click();
  for (const [i, text] of GROUPS.entries()) {
    if (i > 0) {
      await page.waitForTimeout(800);
      await page.keyboard.press("Enter");
    }
    await page.keyboard.type(text);
  }
  await settle(page);
  expect(await stored(page)).toEqual(GROUPS);
});

const editorOf = (page: Page) => page.getByTestId("editor");
const inEditor = (page: Page) => editorOf(page).locator(".bn-inline-content").last().click();
const undoKey = (page: Page) => page.keyboard.press("ControlOrMeta+z");

async function settle(page: Page) {
  await page.waitForTimeout(SAVE_DEBOUNCE_MS * 2);
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");
}

/** Texts of the non-empty top-level blocks in the store. */
async function stored(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const fake = window.__folioFake!;
    const pages = await fake.pagesList();
    const tabs = await fake.tabsList(pages[0]!.id);
    const tree = await fake.tabLoad(tabs[0]!.id);
    const text = (n: { content: unknown }) =>
      JSON.stringify(n.content).match(/"text":"([^"]*)"/g)?.map((m) => m.slice(8, -1)).join("") ?? "";
    return tree.map(text).filter((t) => t !== "");
  });
}

async function expectUntouched(page: Page) {
  await settle(page);
  expect(await stored(page)).toEqual(GROUPS);
  await page.reload();
  await page.getByTestId("tree-item").first().click();
  await expect(editorOf(page)).toBeVisible();
  expect(await stored(page)).toEqual(GROUPS);
}

test("undo with the sidebar item focused leaves the document alone", async ({ page }) => {
  await page.getByTestId("tree-item").first().focus();
  await undoKey(page);
  await expectUntouched(page);
});

test("undo on a blank area leaves the document alone", async ({ page }) => {
  await page.mouse.click(1380, 880);
  await undoKey(page);
  await expectUntouched(page);
});

test("undo in the find input leaves the document alone", async ({ page }) => {
  await page.evaluate(() => window.__folioFake!.emitMenu("find"));
  await expect(page.getByTestId("find-input")).toBeFocused();
  await undoKey(page);
  await expectUntouched(page);
});

test("undo after an escape-cancelled drag leaves the document alone", async ({ page }) => {
  await editorOf(page).locator(".bn-inline-content", { hasText: /^Hai$/ }).hover();
  const handle = (await page.getByTestId("side-drag").boundingBox())!;
  const dest = (await editorOf(page).locator(".bn-inline-content", { hasText: /^Ba$/ }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(dest.x + 40, dest.y + dest.height - 2, { steps: 10 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await undoKey(page);
  await expectUntouched(page);
});

test("undo after opening and closing the drag menu leaves the document alone", async ({ page }) => {
  await editorOf(page).locator(".bn-inline-content", { hasText: /^Hai$/ }).hover();
  await page.getByTestId("side-drag").click();
  await expect(page.getByTestId("drag-menu-delete")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("drag-menu-delete")).toHaveCount(0);
  await undoKey(page);
  await expectUntouched(page);
});

test("title undo reverts the title and not the body", async ({ page }) => {
  const title = page.getByTestId("page-title");
  await title.click();
  await page.keyboard.type("T");
  await expect(title).toHaveValue("T");
  await undoKey(page);
  await expect(title).toHaveValue("");
  await expectUntouched(page);
});

test("execCommand undo and redo move exactly one step", async ({ page }) => {
  await inEditor(page);
  await page.evaluate(() => document.execCommand("undo"));
  await settle(page);
  expect(await stored(page)).toEqual(["Một", "Hai"]);
  await page.evaluate(() => document.execCommand("redo"));
  await settle(page);
  expect(await stored(page)).toEqual(GROUPS);
});

test("undo with focus in the editor undoes exactly one step", async ({ page }) => {
  await inEditor(page);
  await undoKey(page);
  await settle(page);
  expect(await stored(page)).toEqual(["Một", "Hai"]);
});

const emit = (page: Page, name: "undo" | "redo") => page.evaluate((n) => window.__folioFake!.emitMenu(n), name);

test("Edit-menu Undo / Redo with focus in the editor step one group at a time, every time (D-026)", async ({ page }) => {
  await inEditor(page);
  const seen: string[][] = [];
  for (let i = 0; i < 3; i++) {
    await emit(page, "undo");
    await settle(page);
    seen.push(await stored(page));
  }
  expect(seen).toEqual([["Một", "Hai"], ["Một"], []]);
  for (const want of [["Một"], ["Một", "Hai"], GROUPS]) {
    await emit(page, "redo");
    await settle(page);
    expect(await stored(page)).toEqual(want);
  }
});

test("Edit-menu Undo with the find input focused undoes the input only", async ({ page }) => {
  await page.evaluate(() => window.__folioFake!.emitMenu("find"));
  const input = page.getByTestId("find-input");
  await expect(input).toBeFocused();
  await page.keyboard.type("abc");
  await expect(input).toHaveValue("abc");
  await emit(page, "undo");
  await expect(input).toHaveValue("");
  await expectUntouched(page);
});

test("Edit-menu Undo with nothing focused leaves the document alone", async ({ page }) => {
  await page.mouse.click(1380, 880);
  await emit(page, "undo");
  await emit(page, "undo");
  await expectUntouched(page);
});
