import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("find highlights folded matches, cycles, and Escape clears", async ({ page }) => {
  await page.getByTestId("sidebar-new-page").click();
  await page.getByTestId("page-title").fill("Tìm");
  await page.getByTestId("page-title").press("Enter");
  await page.keyboard.type("Đà Nẵng và đà nẵng");

  await page.evaluate(() => window.__folioFake!.emitMenu("find"));
  const input = page.getByTestId("find-input");
  await expect(input).toBeFocused();
  await input.fill("nang");
  await expect(page.getByTestId("find-count")).toHaveText("1/2");
  await expect(page.locator(".find-match")).toHaveCount(2);
  await expect(page.locator(".find-match-current")).toHaveCount(1);
  // Typing in the bar keeps focus in the bar.
  await expect(input).toBeFocused();

  await page.getByTestId("find-next").click();
  await expect(page.getByTestId("find-count")).toHaveText("2/2");
  await input.press("Shift+Enter");
  await expect(page.getByTestId("find-count")).toHaveText("1/2");

  await input.press("Escape");
  await expect(page.getByTestId("find-input")).toHaveCount(0);
  await expect(page.locator(".find-match")).toHaveCount(0);

  // Reopening re-applies the previous query.
  await page.evaluate(() => window.__folioFake!.emitMenu("find"));
  await expect(page.getByTestId("find-count")).toHaveText("1/2");
  await page.getByTestId("find-input").fill("zzz");
  await expect(page.getByTestId("find-count")).toHaveText("Không có kết quả");

  // Escape with focus in the editor closes the bar too.
  await page.locator(".bn-editor").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("find-input")).toHaveCount(0);
  await expect(page.locator(".find-match")).toHaveCount(0);
});

test("Escape with the emoji picker open closes only the picker, not the find bar", async ({ page }) => {
  await page.getByTestId("sidebar-new-page").click();
  await page.getByTestId("page-title").press("Enter");
  await page.keyboard.type("abc ");

  await page.evaluate(() => window.__folioFake!.emitMenu("find"));
  await expect(page.getByTestId("find-input")).toBeFocused();
  await page.locator(".bn-inline-content").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(":smi");
  await expect(page.locator(".bn-grid-suggestion-menu")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".bn-grid-suggestion-menu")).toHaveCount(0);
  await expect(page.getByTestId("find-input")).toBeVisible();

  // Without a picker, Escape from the editor closes the bar.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("find-input")).toHaveCount(0);
  await expect(page.locator(".bn-editor")).not.toBeFocused(); // BlockNote's own Escape blurs (D-016)
});
