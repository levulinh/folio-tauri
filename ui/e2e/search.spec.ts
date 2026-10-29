import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const results = (page: Page) => page.getByTestId("search-result");
const input = (page: Page) => page.getByTestId("search-input");

async function newPage(page: Page, title: string, body = "") {
  await page.getByTestId("sidebar-new-page").click();
  await page.getByTestId("page-title").fill(title);
  if (body) {
    await page.getByTestId("editor").locator(".bn-inline-content").first().click();
    await page.keyboard.type(body);
  }
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");
}

test("accentless query finds accented body", async ({ page }) => {
  await newPage(page, "Nhật ký", "Hôm nay đi Đà Nẵng");
  await page.getByTestId("search-open").click();
  await input(page).fill("da nang");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText("Đà Nẵng");
});

test("title match first", async ({ page }) => {
  await newPage(page, "Ghi chú", "du lịch Đà Nẵng");
  await newPage(page, "Đà Nẵng", "");
  await page.getByTestId("search-open").click();
  await input(page).fill("da nang");
  await expect(results(page)).toHaveCount(2);
  await expect(results(page).first().getByTestId("search-result-title")).toHaveText("Đà Nẵng");
});

test("click opens page", async ({ page }) => {
  await newPage(page, "Một", "alpha");
  await newPage(page, "Hai", "beta");
  const first = page.getByTestId("tree-item").first();
  const oneId = await first.getAttribute("data-page-id");
  await page.getByTestId("search-open").click();
  await input(page).fill("alpha");
  await expect(results(page)).toHaveCount(1);
  await results(page).first().click();
  await expect(page.getByTestId("page-title")).toHaveValue("Một");
  expect(oneId).toBeTruthy();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("no results message", async ({ page }) => {
  await newPage(page, "Một", "alpha");
  await page.getByTestId("search-open").click();
  await input(page).fill("zzzz");
  await expect(page.getByTestId("search-empty")).toHaveText("Không tìm thấy kết quả");
  await input(page).press("Escape");
  await expect(page.getByTestId("tree-item")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("search-open")).toBeFocused();
});

test("shift-cmd-f focuses", async ({ page }) => {
  await page.getByTestId("empty-create-first").click();
  await expect(input(page)).toHaveCount(0);
  await page.evaluate(() => window.__folioFake!.emitMenu("search"));
  await expect(input(page)).toBeFocused();
});

test("Enter right after typing opens the result of the full query", async ({ page }) => {
  await newPage(page, "Đà Lạt", "alpha");
  await newPage(page, "Đà Nẵng", "beta");
  await page.getByTestId("search-open").click();
  await input(page).pressSequentially("da nang");
  await input(page).press("Enter");
  await expect(page.getByTestId("page-title")).toHaveValue("Đà Nẵng");
});

test("floating search traps focus, guards IME Escape and document shortcuts, and has no double focus border", async ({ page }) => {
  await newPage(page, "Ghi chú", "nội dung");
  await page.getByTestId("search-open").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(input(page)).toBeFocused();
  expect(await input(page).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  await input(page).dispatchEvent("compositionstart");
  await input(page).dispatchEvent("keydown", { key: "Escape", keyCode: 229, isComposing: true });
  await expect(dialog).toBeVisible();
  await input(page).dispatchEvent("compositionend");
  await page.evaluate(() => { window.__folioFake!.emitMenu("new-page"); window.__folioFake!.emitMenu("find"); });
  await expect(page.getByTestId("tree-item")).toHaveCount(1);
  await expect(page.getByTestId("find-bar")).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator("button").last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("search-open")).toBeFocused();
});

test("repeated search refocuses input and settings opened from search returns to its trigger", async ({ page }) => {
  await page.getByTestId("search-open").click();
  await expect(input(page)).toBeFocused();
  await page.getByRole("button", { name: "Đóng tìm kiếm", exact: true }).focus();
  await page.evaluate(() => window.__folioFake!.emitMenu("search"));
  await expect(input(page)).toBeFocused();
  await page.keyboard.press("ControlOrMeta+,");
  await expect(page.getByTestId("appearance-settings")).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("search-open")).toBeFocused();
});
