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
const table = (page: Page) => editorOf(page).locator("table");
const rows = (page: Page) => table(page).locator("tr");
const cols = (page: Page) => table(page).locator("tr").first().locator("td, th");
const cell = (page: Page, r: number, c: number) => rows(page).nth(r).locator("td, th").nth(c);
const rowHandle = (page: Page) => page.getByTestId("table-handle-row");
const colHandle = (page: Page) => page.getByTestId("table-handle-column");
const menuItems = (page: Page) => page.locator('.bn-table-handle-menu [role^="menuitem"]');

async function insertTable(page: Page) {
  await editorOf(page).locator(".bn-inline-content").first().click();
  await page.keyboard.type("/table");
  await page.keyboard.press("Enter");
  await expect(table(page)).toHaveCount(1);
}

async function settle(page: Page) {
  await page.waitForTimeout(SAVE_DEBOUNCE_MS * 2);
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");
}

/** The stored table block, or null when the page has none. */
async function storedTable(page: Page) {
  return page.evaluate(async () => {
    const fake = window.__folioFake!;
    const pages = await fake.pagesList();
    const tabs = await fake.tabsList(pages[0]!.id);
    const tree = await fake.tabLoad(tabs[0]!.id);
    const node = tree.find((n) => n.type === "table");
    if (!node) return null;
    const content = node.content as { rows: { cells: unknown[] }[]; headerRows?: number; headerCols?: number };
    return { rows: content.rows.length, cols: content.rows[0]!.cells.length, headerRows: content.headerRows, headerCols: content.headerCols };
  });
}

async function reopen(page: Page) {
  await settle(page);
  await page.reload();
  await page.getByTestId("tree-item").first().click();
  await expect(editorOf(page)).toBeVisible();
}

async function hoverCell(page: Page, r: number, c: number) {
  await cell(page, r, c).hover();
  await expect(rowHandle(page)).toBeVisible();
  await expect(colHandle(page)).toBeVisible();
}

async function openRowMenu(page: Page, r: number) {
  await hoverCell(page, r, 0);
  await rowHandle(page).click();
  await expect(page.locator(".bn-table-handle-menu")).toBeVisible();
}

async function openColMenu(page: Page, c: number) {
  await hoverCell(page, 0, c);
  await colHandle(page).click();
  await expect(page.locator(".bn-table-handle-menu")).toBeVisible();
}

const item = (page: Page, name: string) => menuItems(page).filter({ hasText: new RegExp(`^${name}$`) });

/** Clicks a menu item and waits for the menu to be gone (it unmounts after a short transition). */
async function choose(page: Page, name: string) {
  await item(page, name).click();
  await expect(page.locator(".bn-table-handle-menu")).toHaveCount(0);
}

test("slash table inserts a 2x3 table with a header toggle off", async ({ page }) => {
  await insertTable(page);
  await expect(rows(page)).toHaveCount(2);
  await expect(cols(page)).toHaveCount(3);
  await expect(table(page).locator("th")).toHaveCount(0);
  await openRowMenu(page, 0);
  await expect(item(page, "Hàng tiêu đề")).toHaveCount(1);
  await expect(table(page).locator("th")).toHaveCount(0);
});

test("hovering a cell shows row and column handles", async ({ page }) => {
  await insertTable(page);
  await expect(rowHandle(page)).toHaveCount(0);
  await hoverCell(page, 1, 2);
});

test("row menu has exactly the four row items", async ({ page }) => {
  await insertTable(page);
  await openRowMenu(page, 0);
  await expect(menuItems(page)).toHaveText(["Thêm hàng phía trên", "Thêm hàng phía dưới", "Xoá hàng", "Hàng tiêu đề"]);
});

test("column menu has exactly the four column items", async ({ page }) => {
  await insertTable(page);
  await openColMenu(page, 0);
  await expect(menuItems(page)).toHaveText(["Thêm cột bên trái", "Thêm cột bên phải", "Xoá cột", "Cột tiêu đề"]);
});

test("add row below and column right", async ({ page }) => {
  await insertTable(page);
  await openRowMenu(page, 1);
  await choose(page, "Thêm hàng phía dưới");
  await expect(rows(page)).toHaveCount(3);
  await openColMenu(page, 2);
  await choose(page, "Thêm cột bên phải");
  await expect(cols(page)).toHaveCount(4);
  await reopen(page);
  await expect(rows(page)).toHaveCount(3);
  await expect(cols(page)).toHaveCount(4);
  expect(await storedTable(page)).toMatchObject({ rows: 3, cols: 4 });
});

test("extend buttons add a row and a column", async ({ page }) => {
  await insertTable(page);
  await cell(page, 1, 2).hover(); // last row and last column: both buttons show
  const addRow = page.locator(".bn-extend-button-add-remove-rows");
  const addCol = page.locator(".bn-extend-button-add-remove-columns");
  await expect(addRow).toBeVisible();
  await addRow.click();
  await expect(rows(page)).toHaveCount(3);
  await cell(page, 2, 2).hover();
  await expect(addCol).toBeVisible();
  await addCol.click();
  await expect(cols(page)).toHaveCount(4);
  await reopen(page);
  expect(await storedTable(page)).toMatchObject({ rows: 3, cols: 4 });
});

test("delete row and delete column", async ({ page }) => {
  await insertTable(page);
  await openRowMenu(page, 1);
  await choose(page, "Xoá hàng");
  await expect(rows(page)).toHaveCount(1);
  await openColMenu(page, 2);
  await choose(page, "Xoá cột");
  await expect(cols(page)).toHaveCount(2);
  await reopen(page);
  expect(await storedTable(page)).toMatchObject({ rows: 1, cols: 2 });
});

test("deleting the last row removes the table and saves", async ({ page }) => {
  await insertTable(page);
  await openRowMenu(page, 1);
  await choose(page, "Xoá hàng");
  await openRowMenu(page, 0);
  await choose(page, "Xoá hàng");
  await expect(table(page)).toHaveCount(0);
  await reopen(page);
  await expect(table(page)).toHaveCount(0);
  expect(await storedTable(page)).toBeNull();
});

test("header row toggle persists", async ({ page }) => {
  await insertTable(page);
  await openRowMenu(page, 0);
  await choose(page, "Hàng tiêu đề");
  await expect(rows(page).first().locator("th")).toHaveCount(3);
  await reopen(page);
  await expect(rows(page).first().locator("th")).toHaveCount(3);
  await expect(rows(page).nth(1).locator("th")).toHaveCount(0);
  expect(await storedTable(page)).toMatchObject({ headerRows: 1 });
});

test("one undo reverts an added row and the store matches", async ({ page }) => {
  await insertTable(page);
  await settle(page);
  await openRowMenu(page, 1);
  await choose(page, "Thêm hàng phía dưới");
  await expect(rows(page)).toHaveCount(3);
  await settle(page);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows(page)).toHaveCount(2);
  await reopen(page);
  await expect(rows(page)).toHaveCount(2);
  expect(await storedTable(page)).toMatchObject({ rows: 2, cols: 3 });
});

/** [row, col] of the table cell holding the caret, or null when the caret is outside any cell. */
async function caretCell(page: Page): Promise<[number, number] | null> {
  return page.evaluate(() => {
    const node = document.getSelection()?.anchorNode;
    const el = node instanceof Element ? node : node?.parentElement;
    const td = el?.closest("td, th");
    const tr = td?.closest("tr");
    if (!td || !tr) return null;
    return [Array.from(tr.parentElement!.children).indexOf(tr), Array.from(tr.children).indexOf(td)] as [number, number];
  });
}

const cellTexts = (page: Page) => rows(page).evaluateAll((trs) => trs.map((tr) => Array.from(tr.children).map((c) => c.textContent ?? "")));

/** The stored text of every cell, row by row. */
async function storedCells(page: Page): Promise<string[][]> {
  return page.evaluate(async () => {
    const fake = window.__folioFake!;
    const pages = await fake.pagesList();
    const tabs = await fake.tabsList(pages[0]!.id);
    const tree = await fake.tabLoad(tabs[0]!.id);
    const node = tree.find((n) => n.type === "table")!;
    const content = node.content as { rows: { cells: unknown[] }[] };
    const text = (cell: unknown): string => {
      const runs = Array.isArray(cell) ? cell : ((cell as { content?: unknown[] }).content ?? []);
      return (runs as { text?: string }[]).map((r) => r.text ?? "").join("");
    };
    return content.rows.map((r) => r.cells.map(text));
  });
}

async function focusCell(page: Page, r: number, c: number) {
  await cell(page, r, c).click();
  expect(await caretCell(page)).toEqual([r, c]);
}

test("tab walks the cells row by row and shift-tab walks back", async ({ page }) => {
  await insertTable(page);
  await focusCell(page, 0, 0);
  for (const word of ["a", "b", "c", "d", "e"]) {
    await page.keyboard.type(word);
    await page.keyboard.press("Tab");
  }
  expect(await caretCell(page)).toEqual([1, 2]);
  await page.keyboard.press("Shift+Tab");
  expect(await caretCell(page)).toEqual([1, 1]);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  expect(await caretCell(page)).toEqual([0, 0]);
  await page.keyboard.press("Shift+Tab"); // first cell: nothing
  expect(await caretCell(page)).toEqual([0, 0]);
  await expect(rows(page)).toHaveCount(2);
  await reopen(page);
  expect(await storedCells(page)).toEqual([["a", "b", "c"], ["d", "e", ""]]);
  expect(await cellTexts(page)).toEqual([["a", "b", "c"], ["d", "e", ""]]);
});

test("tab in the last cell adds a row, and one undo removes it", async ({ page }) => {
  await insertTable(page);
  await focusCell(page, 1, 2);
  await page.keyboard.type("z");
  await settle(page);
  await page.keyboard.press("Tab");
  await expect(rows(page)).toHaveCount(3);
  expect(await caretCell(page)).toEqual([2, 0]);
  await page.keyboard.type("n");
  await settle(page);
  await reopen(page);
  expect(await storedTable(page)).toMatchObject({ rows: 3, cols: 3 });
  expect((await storedCells(page))[2]).toEqual(["n", "", ""]);

  await focusCell(page, 2, 2);
  await page.keyboard.press("Tab"); // a second added row, the one to undo
  await expect(rows(page)).toHaveCount(4);
  await settle(page);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows(page)).toHaveCount(3); // the row and the caret move are one step
  await settle(page);
  expect(await storedTable(page)).toMatchObject({ rows: 3, cols: 3 });
  await reopen(page);
  await expect(rows(page)).toHaveCount(3);
});

test("a single undo after adding a row with Tab removes it from a fresh table", async ({ page }) => {
  await insertTable(page);
  await settle(page);
  await focusCell(page, 1, 2);
  await page.keyboard.press("Tab");
  await expect(rows(page)).toHaveCount(3);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows(page)).toHaveCount(2);
  expect(await caretCell(page)).toEqual([1, 2]);
});

test("enter moves to the cell below and adds a row from the last row", async ({ page }) => {
  await insertTable(page);
  await focusCell(page, 0, 1);
  await page.keyboard.type("x");
  await page.keyboard.press("Enter");
  expect(await caretCell(page)).toEqual([1, 1]);
  await page.keyboard.type("y");
  await page.keyboard.press("Enter");
  await expect(rows(page)).toHaveCount(3);
  expect(await caretCell(page)).toEqual([2, 1]);
  await page.keyboard.type("w");
  await reopen(page);
  expect(await storedTable(page)).toMatchObject({ rows: 3, cols: 3 });
  expect(await storedCells(page)).toEqual([["", "x", ""], ["", "y", ""], ["", "w", ""]]);
});

test("shift-enter inserts a line break inside the cell", async ({ page }) => {
  await insertTable(page);
  await focusCell(page, 0, 0);
  await page.keyboard.type("one");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("two");
  expect(await caretCell(page)).toEqual([0, 0]);
  await expect(rows(page)).toHaveCount(2);
  await reopen(page);
  expect((await storedCells(page))[0]![0]).toBe("one\ntwo");
});

test("table as last block keeps a paragraph after it", async ({ page }) => {
  await insertTable(page);
  await page.keyboard.type("x");
  const trailing = editorOf(page).locator(".bn-trailing-block"); // BlockNote's clickable area below the last block
  const tableBox = (await table(page).boundingBox())!;
  const box = (await trailing.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(tableBox.y + tableBox.height - 1); // it sits below the table
  await page.mouse.click(box.x + 20, box.y + box.height / 2);
  const where = await page.evaluate(() => {
    const node = document.getSelection()?.anchorNode;
    const el = node instanceof Element ? node : node?.parentElement;
    return { inCell: !!el?.closest("td, th"), inParagraph: !!el?.closest('[data-content-type="paragraph"]') };
  });
  expect(where).toEqual({ inCell: false, inParagraph: true });
  await page.keyboard.type("below");
  await reopen(page);
  const stored = await page.evaluate(async () => {
    const fake = window.__folioFake!;
    const pages = await fake.pagesList();
    const tabs = await fake.tabsList(pages[0]!.id);
    return (await fake.tabLoad(tabs[0]!.id)).map((n) => n.type);
  });
  expect(stored).toEqual(["table", "paragraph"]);
  await expect(editorOf(page).locator('[data-content-type="paragraph"]').last()).toHaveText("below");
});

const toolbar = (page: Page) => page.getByTestId("fmt-toolbar");

/** Types `text` in cell [r, c] and selects exactly it (Shift+ArrowLeft per character: Shift+Home can reach into the neighbouring cells). */
async function typeAndSelectInCell(page: Page, r: number, c: number, text: string) {
  await focusCell(page, r, c);
  await page.keyboard.type(text);
  for (let i = 0; i < text.length; i++) await page.keyboard.press("Shift+ArrowLeft");
}

test("toolbar appears for a selection inside a cell", async ({ page }) => {
  await insertTable(page);
  await typeAndSelectInCell(page, 0, 1, "xin chào");
  await expect(toolbar(page)).toBeVisible();
  await expect(toolbar(page).getByTestId("fmt-bold")).toBeVisible();
});

test("bold, italic, code and link in a cell persist", async ({ page }) => {
  await insertTable(page);
  await typeAndSelectInCell(page, 0, 0, "alpha");
  await page.keyboard.press("ControlOrMeta+b");
  await expect(cell(page, 0, 0).locator("strong")).toHaveText("alpha");
  await typeAndSelectInCell(page, 0, 1, "beta");
  await page.keyboard.press("ControlOrMeta+i");
  await expect(cell(page, 0, 1).locator("em")).toHaveText("beta");
  await typeAndSelectInCell(page, 0, 2, "gamma");
  await expect(toolbar(page)).toBeVisible();
  await page.getByTestId("fmt-code").click();
  await expect(cell(page, 0, 2).locator("code")).toHaveText("gamma");
  await typeAndSelectInCell(page, 1, 0, "delta");
  await expect(toolbar(page)).toBeVisible();
  await page.getByTestId("fmt-link").click();
  const field = page.locator(".bn-popover-content input, .bn-form-popover input").first();
  await expect(field).toBeVisible();
  await field.fill("example.com");
  await field.press("Enter");
  await expect(cell(page, 1, 0).locator("a")).toHaveText("delta");
  await reopen(page);
  await expect(cell(page, 0, 0).locator("strong")).toHaveText("alpha");
  await expect(cell(page, 0, 1).locator("em")).toHaveText("beta");
  await expect(cell(page, 0, 2).locator("code")).toHaveText("gamma");
  await expect(cell(page, 1, 0).locator("a")).toHaveText("delta");
});

test("line breaks in a cell persist", async ({ page }) => {
  await insertTable(page);
  await focusCell(page, 0, 0);
  await page.keyboard.type("một");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("hai");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("ba");
  await reopen(page);
  expect((await storedCells(page))[0]![0]).toBe("một\nhai\nba");
  await expect(rows(page)).toHaveCount(2);
  await expect(cell(page, 0, 0).locator("br")).toHaveCount(2);
  expect(await cellTexts(page)).toHaveLength(2);
});

async function blockCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const fake = window.__folioFake!;
    const pages = await fake.pagesList();
    const tabs = await fake.tabsList(pages[0]!.id);
    return (await fake.tabLoad(tabs[0]!.id)).length;
  });
}

test("pasting 30 lines into a cell keeps them in the cell", async ({ page }) => {
  await insertTable(page);
  await settle(page);
  const before = await blockCount(page);
  await focusCell(page, 0, 0);
  const text = Array.from({ length: 30 }, (_, i) => `dòng ${i + 1}`).join("\n");
  // Method: synthetic ClipboardEvent("paste") with text/plain on the focused cell's editable.
  await page.evaluate((t) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", t);
    const target = document.activeElement ?? document.querySelector(".bn-editor")!;
    target.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
  await expect(cell(page, 0, 0)).toContainText("dòng 30");
  await expect(rows(page)).toHaveCount(2);
  expect(await blockCount(page)).toBe(before);
  const start = Date.now();
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 3000 });
  expect(Date.now() - start).toBeLessThan(3000);
  await reopen(page);
  const stored = await storedCells(page);
  expect(stored[0]![0]).toBe(text);
  expect(stored.flat().filter((t) => t !== "")).toHaveLength(1);
  expect(await blockCount(page)).toBe(before);
});

test("search finds text typed in a cell", async ({ page }) => {
  await insertTable(page);
  await focusCell(page, 1, 1);
  await page.keyboard.type("Hà Nội");
  await settle(page);
  await page.getByTestId("search-input").fill("ha noi");
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByTestId("search-result").first()).toContainText("Hà Nội");
});
