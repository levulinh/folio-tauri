import { expect, test } from "@playwright/test";

// Integration contract: the application schema/menu must register these specs first.
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("empty-create-first").click();
  await expect(page.getByTestId("editor")).toBeVisible();
});

for (const count of [2, 3]) {
  test(`${count} columns edit independently, persist, and stack in narrow containers`, async ({ page }) => {
    await page.getByTestId("editor").locator(".bn-inline-content").first().click();
    await page.keyboard.type(`/${count} columns`);
    await page.getByTestId("slash-item").filter({ hasText: `${count} columns` }).click();
    const layout = page.getByTestId("columns-layout");
    const columns = layout.getByTestId("column");
    await expect(columns).toHaveCount(count);
    // No click: insertion must put the caret in the first paragraph.
    await page.keyboard.type("First column");
    await expect(columns.first()).toHaveText("First column");
    for (let index = 1; index < count; index++) {
      await columns.nth(index).locator(".bn-inline-content").first().click();
      await page.keyboard.type(`Column ${index + 1}`);
    }
    const first = (await columns.first().boundingBox())!;
    const second = (await columns.nth(1).boundingBox())!;
    expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1);
    expect(second.x - (first.x + first.width)).toBeCloseTo(24, 0);
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");
    await page.reload();
    await page.getByTestId("tree-item").first().click();
    await expect(columns).toHaveCount(count);
    await expect(columns.first()).toHaveText("First column");
    await expect(columns.last()).toHaveText(`Column ${count}`);
    // Change the actual container width, independent of viewport/sidebar dimensions.
    await layout.evaluate((el) => { el.style.width = "599px"; });
    await expect.poll(async () => {
      const a = (await columns.first().boundingBox())!;
      const b = (await columns.nth(1).boundingBox())!;
      return b.y >= a.y + a.height && Math.abs(a.x - b.x) <= 1;
    }).toBe(true);
  });
}

test("one undo removes a newly inserted layout and redo restores it", async ({ page }) => {
  await page.getByTestId("editor").locator(".bn-inline-content").first().click();
  await page.keyboard.type("/2 columns");
  await page.getByTestId("slash-item").filter({ hasText: "2 columns" }).click();
  await expect(page.getByTestId("column")).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByTestId("columns-layout")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.getByTestId("column")).toHaveCount(2);
});
