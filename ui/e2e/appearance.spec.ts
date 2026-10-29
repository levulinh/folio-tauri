import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("all preferences preview, persist on reopen and reload, with the editor retained", async ({ page }) => {
  await page.getByTestId("empty-create-first").click();
  const editor = page.getByTestId("editor");
  await expect(editor).toBeVisible();
  await page.getByTestId("open-settings").click();
  for (const mode of ["system", "light", "dark"]) {
    for (const accent of ["neutral", "blue", "olive", "purple"]) {
      await page.getByTestId(`appearance-mode-${mode}`).check();
      await page.getByTestId(`appearance-accent-${accent}`).check();
      await expect(page.locator("html")).toHaveAttribute("data-accent", accent);
      if (mode !== "system") await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
      await expect(page.getByTestId("appearance-settings")).toBeVisible();
      await expect(editor).toHaveAttribute("data-color-scheme", mode === "system" ? "light" : mode);
    }
  }
  await page.getByTestId("appearance-close").click();
  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("appearance-mode-dark")).toBeChecked();
  await expect(page.getByTestId("appearance-accent-purple")).toBeChecked();
  await expect(page.getByTestId("appearance-settings").getByRole("status")).toHaveCount(0);
  await page.reload();
  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("appearance-mode-dark")).toBeChecked();
  await expect(page.getByTestId("appearance-accent-purple")).toBeChecked();
});

test("focus trap, escape, restore, shortcut and menu guard work without a page", async ({ page }) => {
  const opener = page.getByTestId("open-settings");
  await opener.focus();
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("appearance-close")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await page.evaluate(() => { for (const name of ["new-page", "new-subpage", "find", "search", "undo", "redo"] as const) window.__folioFake!.emitMenu(name); });
  await expect(page.getByTestId("tree-item")).toHaveCount(0);
  await expect(page.getByTestId("find-bar")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.keyboard.press("ControlOrMeta+,");
  await expect(dialog).toBeVisible();
  await page.evaluate(() => window.__folioFake!.emitMenu("settings"));
  await expect(dialog).toHaveCount(1);
});

test("composition defers and deduplicates opening and IME escape stays open", async ({ page }) => {
  const input = page.getByTestId("search-input");
  await input.focus();
  await input.dispatchEvent("compositionstart");
  await page.evaluate(() => { window.__folioFake!.emitMenu("settings"); window.__folioFake!.emitMenu("settings"); });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await input.dispatchEvent("compositionend");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.evaluate(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 229, bubbles: true })));
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("radio keyboard selection and menu events cannot alter an open editor", async ({ page }) => {
  await page.getByTestId("empty-create-first").click();
  const editor = page.getByTestId("editor");
  const line = editor.locator(".bn-inline-content").first();
  await line.click();
  await page.keyboard.type("hello");
  await page.getByTestId("open-settings").click();
  await page.getByTestId("appearance-mode-system").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("appearance-mode-light")).toBeChecked();
  await page.getByTestId("appearance-accent-neutral").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("appearance-accent-blue")).toBeChecked();
  await page.evaluate(() => { for (const name of ["new-page", "new-subpage", "find", "search", "undo", "redo"] as const) window.__folioFake!.emitMenu(name); });
  await expect(page.getByTestId("tree-item")).toHaveCount(1);
  await expect(page.getByTestId("find-bar")).toHaveCount(0);
  await expect(line).toHaveText("hello");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a failed preference save remains visible and retry persists the choice", async ({ page }) => {
  await page.evaluate(() => {
    const fake = window.__folioFake!;
    const save = fake.appearanceSet.bind(fake);
    let fail = true;
    fake.appearanceSet = (value) => {
      if (fail) { fail = false; return Promise.reject(new Error("failed")); }
      return save(value);
    };
  });
  await page.getByTestId("open-settings").click();
  await page.getByTestId("appearance-accent-blue").check();
  await expect(page.getByRole("alert")).toContainText("Không lưu được giao diện. Thử lại.");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "blue");
  await page.getByTestId("appearance-retry").click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await page.getByTestId("open-settings").click();
  await expect(page.getByTestId("appearance-accent-blue")).toBeChecked();
});
