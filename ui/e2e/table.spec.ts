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
