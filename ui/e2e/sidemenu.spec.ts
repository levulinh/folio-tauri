import { expect, test, type Page } from "@playwright/test";
import { SAVE_DEBOUNCE_MS } from "../src/editor/saveTiming";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("empty-create-first").click();
  await expect(page.getByTestId("tree-item")).toHaveCount(1);
  await expect(page.getByTestId("editor")).toBeVisible();
});

const editorOf = (page: Page) => page.getByTestId("editor");
const firstLine = (page: Page) => editorOf(page).locator(".bn-inline-content").first();
const outer = (page: Page) => editorOf(page).locator(".bn-block-outer");
const add = (page: Page) => page.getByTestId("side-add");
const drag = (page: Page) => page.getByTestId("side-drag");
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");

/** Text of the whole document as an indented outline: top-level `A`, a child `  B1`. */
async function outline(page: Page): Promise<string[]> {
  return editorOf(page).locator(".bn-block").evaluateAll((els) =>
    els
      .filter((el) => el.querySelector(":scope > .bn-block-content"))
      .map((el) => {
        let depth = 0;
        for (let p = el.parentElement?.closest(".bn-block"); p; p = p.parentElement?.closest(".bn-block")) depth += 1;
        const text = el.querySelector(":scope > .bn-block-content .bn-inline-content")?.textContent ?? "";
        return "  ".repeat(depth) + text;
      })
      .filter((line) => line.trim() !== ""),
  );
}

async function reopen(page: Page) {
  await page.reload();
  await page.getByTestId("tree-item").first().click();
  await expect(editorOf(page)).toBeVisible();
}

/** A, B (bullet) with child B1, C. */
async function seed(page: Page) {
  await firstLine(page).click();
  await page.keyboard.type("A");
  await page.keyboard.press("Enter");
  await page.keyboard.type("- B");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("B1");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter"); // empty bullet -> paragraph
  await page.keyboard.type("C");
  await expect.poll(() => outline(page)).toEqual(["A", "B", "  B1", "C"]);
  await saved(page);
}

/** Counts the saves the editor sends from now on (the fake backend is the page's `backend`). */
async function countSaves(page: Page) {
  await page.evaluate(() => {
    const fake = window.__folioFake as unknown as { tabApply: (...a: unknown[]) => Promise<unknown> };
    const w = window as unknown as { __saves: number };
    w.__saves = 0;
    const original = fake.tabApply.bind(fake);
    fake.tabApply = (...a) => {
      w.__saves += 1;
      return original(...a);
    };
  });
}
const saves = (page: Page) => page.evaluate(() => (window as unknown as { __saves: number }).__saves);

async function hoverBlock(page: Page, text: string) {
  await editorOf(page).locator(".bn-inline-content", { hasText: new RegExp(`^${text}$`) }).hover();
  await expect(drag(page)).toBeVisible();
}

test("hover shows plus and drag handle", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("Xin chào");
  await page.keyboard.press("Escape");
  await firstLine(page).hover();
  await expect(add(page)).toBeVisible();
  await expect(drag(page)).toBeVisible();
});

test("they hide after typing", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("x");
  await firstLine(page).hover();
  await page.mouse.move(700, 500);
  await firstLine(page).hover();
  await expect(drag(page)).toBeVisible();
  await page.keyboard.type("y");
  await expect(drag(page)).toHaveCount(0);
});

test("plus inserts a text block below and opens the slash menu", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("Một");
  const before = await outer(page).count();
  await firstLine(page).hover();
  await add(page).click();
  await expect(outer(page)).toHaveCount(before + 1);
  await expect(page.getByTestId("slash-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.type("Đây");
  // The caret is in the new block, the second one.
  await expect(editorOf(page).locator(".bn-inline-content").nth(1)).toHaveText("Đây");
  await expect(firstLine(page)).toHaveText("Một");
});

test("plus on an empty block reuses it", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("Một");
  await page.keyboard.press("Enter");
  const before = await outer(page).count();
  await editorOf(page).locator(".bn-inline-content").nth(1).hover();
  await expect(add(page)).toBeVisible();
  await add(page).click();
  await expect(outer(page)).toHaveCount(before);
  await expect(page.getByTestId("slash-menu")).toBeVisible();
});

test("drag menu has only delete", async ({ page }) => {
  await firstLine(page).click();
  await page.keyboard.type("Một");
  await page.keyboard.press("Escape");
  await firstLine(page).hover();
  await drag(page).click();
  await expect(page.locator(".bn-drag-handle-menu .bn-menu-item")).toHaveCount(1);
  await expect(page.getByTestId("drag-menu-delete")).toHaveText("Xoá");
});

test("delete removes the block and its children", async ({ page }) => {
  await seed(page);
  await hoverBlock(page, "B");
  await drag(page).click();
  await page.getByTestId("drag-menu-delete").click();
  await expect.poll(() => outline(page)).toEqual(["A", "C"]);
  await saved(page);
  await reopen(page);
  await expect.poll(() => outline(page)).toEqual(["A", "C"]);
});

/** Drags B's handle onto the lower half of `target`'s block. */
async function dragBelow(page: Page, target: string) {
  const handle = (await drag(page).boundingBox())!;
  const dest = (await editorOf(page).locator(".bn-inline-content", { hasText: new RegExp(`^${target}$`) }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 10, handle.y + 10, { steps: 4 });
  await page.mouse.move(dest.x + 40, dest.y + dest.height - 2, { steps: 12 });
  await page.mouse.up();
}

test("drag moves a list item with its children", async ({ page }) => {
  await seed(page);
  await hoverBlock(page, "B");
  await dragBelow(page, "C");
  await expect.poll(() => outline(page)).toEqual(["A", "C", "B", "  B1"]);
  await saved(page);
  await reopen(page);
  await expect.poll(() => outline(page)).toEqual(["A", "C", "B", "  B1"]);
});

test("one undo reverts a drag and the store matches", async ({ page }) => {
  await seed(page);
  await hoverBlock(page, "B");
  await dragBelow(page, "C");
  await expect.poll(() => outline(page)).toEqual(["A", "C", "B", "  B1"]);
  await saved(page);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => outline(page)).toEqual(["A", "B", "  B1", "C"]);
  await saved(page);
  await reopen(page);
  await expect.poll(() => outline(page)).toEqual(["A", "B", "  B1", "C"]);
});

test("drop onto itself does nothing", async ({ page }) => {
  await seed(page);
  await countSaves(page);
  await hoverBlock(page, "B");
  const handle = (await drag(page).boundingBox())!;
  const self = (await editorOf(page).locator(".bn-inline-content", { hasText: /^B$/ }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(self.x + 40, self.y + self.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(SAVE_DEBOUNCE_MS * 2); // well past the save debounce
  await expect.poll(() => outline(page)).toEqual(["A", "B", "  B1", "C"]);
  expect(await saves(page)).toBe(0);
  await saved(page);
});

test("escape cancels a drag", async ({ page }) => {
  await seed(page);
  await countSaves(page);
  await hoverBlock(page, "B");
  const handle = (await drag(page).boundingBox())!;
  const dest = (await editorOf(page).locator(".bn-inline-content", { hasText: /^C$/ }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(dest.x + 40, dest.y + dest.height - 2, { steps: 10 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(SAVE_DEBOUNCE_MS * 2); // well past the save debounce
  await expect.poll(() => outline(page)).toEqual(["A", "B", "  B1", "C"]);
  expect(await saves(page)).toBe(0);
  await saved(page);
});
