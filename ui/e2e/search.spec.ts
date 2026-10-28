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
  await input(page).fill("da nang");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText("Đà Nẵng");
});

test("title match first", async ({ page }) => {
  await newPage(page, "Ghi chú", "du lịch Đà Nẵng");
  await newPage(page, "Đà Nẵng", "");
  await input(page).fill("da nang");
  await expect(results(page)).toHaveCount(2);
  await expect(results(page).first().getByTestId("search-result-title")).toHaveText("Đà Nẵng");
});

test("click opens page", async ({ page }) => {
  await newPage(page, "Một", "alpha");
  await newPage(page, "Hai", "beta");
  const first = page.getByTestId("tree-item").first();
  const oneId = await first.getAttribute("data-page-id");
  await input(page).fill("alpha");
  await expect(results(page)).toHaveCount(1);
  await results(page).first().click();
  await expect(page.getByTestId("page-title")).toHaveValue("Một");
  expect(await results(page).first().getAttribute("data-page-id")).toBe(oneId);
});

test("no results message", async ({ page }) => {
  await newPage(page, "Một", "alpha");
  await input(page).fill("zzzz");
  await expect(page.getByTestId("search-empty")).toHaveText("Không tìm thấy kết quả");
  await input(page).press("Escape");
  await expect(page.getByTestId("tree-item")).toHaveCount(1);
  await expect(input(page)).toHaveValue("");
});

test("shift-cmd-f focuses", async ({ page }) => {
  await page.getByTestId("empty-create-first").click();
  await expect(input(page)).not.toBeFocused();
  await page.evaluate(() => window.__folioFake!.emitMenu("search"));
  await expect(input(page)).toBeFocused();
});
