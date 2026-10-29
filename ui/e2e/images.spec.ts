import { expect, test } from "@playwright/test";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("empty-create-first").click();
});

test("uploaded image persists as a Folio asset across reload and its name is searchable", async ({ page }) => {
  const line = page.getByTestId("editor").locator(".bn-inline-content").first();
  await line.click();
  await page.keyboard.type("/image");
  await page.getByTestId("slash-item").filter({ hasText: "Image" }).click();
  const block = page.locator('.bn-block-content[data-content-type="image"]');
  await expect(block).toBeVisible();
  await block.click();
  await page.locator('input[type="file"]').setInputFiles({ name: "ky-niem.png", mimeType: "image/png", buffer: png });
  const image = block.locator("img");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1);
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");
  const stored = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("folio.fake.v1")!).blocks));
  expect(stored).toContain("folio-asset:");
  expect(stored).not.toContain("data:image");
  await page.reload();
  await page.getByTestId("tree-item").first().click();
  await expect(page.locator('.bn-block-content[data-content-type="image"] img')).toBeVisible();
  await page.getByTestId("search-open").click();
  await page.getByTestId("search-input").fill("ky niem");
  await expect(page.getByTestId("search-result")).toHaveCount(1);
});
