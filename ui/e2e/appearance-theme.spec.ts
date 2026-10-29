import { expect, test } from "@playwright/test";

const palettes = {
  light: { neutral: ["rgb(80, 80, 80)", "rgb(229, 229, 229)"], blue: ["rgb(53, 103, 160)", "rgb(228, 237, 248)"], olive: ["rgb(83, 107, 82)", "rgb(227, 233, 220)"], purple: ["rgb(118, 89, 154)", "rgb(238, 231, 246)"] },
  dark: { neutral: ["rgb(196, 196, 196)", "rgb(57, 57, 57)"], blue: ["rgb(156, 191, 240)", "rgb(41, 57, 78)"], olive: ["rgb(182, 203, 166)", "rgb(52, 63, 46)"], purple: ["rgb(197, 173, 232)", "rgb(60, 48, 75)"] },
} as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("empty-create-first").click();
  await expect(page.getByTestId("editor")).toBeVisible();
});

for (const mode of ["light", "dark"] as const) {
  test(`${mode} palettes theme controls and portalled overlays on neutral surfaces`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: mode === "light" ? "dark" : "light" });
    await page.getByTestId("open-settings").click();
    await page.getByTestId(`appearance-mode-${mode}`).check();
    const semantic = await page.locator("html").evaluate((el) => {
      const css = getComputedStyle(el);
      return [css.getPropertyValue("--danger"), css.getPropertyValue("--warn")];
    });
    for (const [accent, [foreground, fill]] of Object.entries(palettes[mode])) {
      await page.getByTestId(`appearance-accent-${accent}`).check();
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
      await expect(page.getByTestId("editor")).toHaveAttribute("data-color-scheme", mode);
      await expect(page.getByTestId("tree-item").first()).toHaveCSS("background-color", fill);
      await expect(page.locator("body")).toHaveCSS("background-color", mode === "light" ? "rgb(252, 252, 252)" : "rgb(34, 34, 34)");
      await expect(page.locator("aside")).toHaveCSS("background-color", mode === "light" ? "rgb(243, 243, 243)" : "rgb(27, 27, 27)");
      await expect(page.getByRole("dialog")).toHaveCSS("background-color", mode === "light" ? "rgb(255, 255, 255)" : "rgb(43, 43, 43)");
      await expect(page.getByTestId(`appearance-accent-${accent}`)).toHaveCSS("accent-color", foreground);
      expect(await page.locator("html").evaluate((el) => {
        const css = getComputedStyle(el);
        return [css.getPropertyValue("--danger"), css.getPropertyValue("--warn")];
      })).toEqual(semantic);
      const ratios = await page.locator("body").evaluate((el) => {
        const css = getComputedStyle(el);
        const luminance = (rgb: string) => {
          const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((x) => x / 255).map((x) => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
          return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
        };
        const probe = document.createElement("span");
        el.append(probe);
        const color = (name: string) => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
        const bg = luminance(css.backgroundColor);
        const contrast = (name: string) => { const n = luminance(color(name)); return (Math.max(n, bg) + .05) / (Math.min(n, bg) + .05); };
        const values = [contrast("--text"), contrast("--text-muted"), contrast("--accent")];
        for (const surface of ["--bg-sidebar", "--bg-hover", "--bg-selected", "--bg-popover"]) {
          const surfaceLum = luminance(color(surface));
          const mutedLum = luminance(color("--text-muted"));
          values.push((Math.max(surfaceLum, mutedLum) + .05) / (Math.min(surfaceLum, mutedLum) + .05));
        }
        probe.remove();
        return values;
      });
      expect(ratios[0]).toBeGreaterThanOrEqual(4.5);
      expect(ratios[1]).toBeGreaterThanOrEqual(4.5);
      expect(ratios[2]).toBeGreaterThanOrEqual(3);
      for (const ratio of ratios.slice(3)) expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    await page.getByTestId("appearance-close").click();
    const line = page.getByTestId("editor").locator(".bn-inline-content").first();
    await line.click();
    await page.keyboard.type("/");
    const menu = page.locator(".bn-suggestion-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("background-color", mode === "light" ? "rgb(255, 255, 255)" : "rgb(43, 43, 43)");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("Tiếng Việt còn nguyên");
    await page.getByTestId("open-settings").click();
    await page.getByTestId(`appearance-mode-${mode === "light" ? "dark" : "light"}`).check();
    await page.getByTestId("appearance-close").click();
    await expect(line).toHaveText("Tiếng Việt còn nguyên");
    await line.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/quote");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Trích dẫn dễ đọc");
    await expect(page.locator("blockquote")).toHaveCSS("color", mode === "light" ? "rgb(170, 170, 170)" : "rgb(102, 102, 102)");
  });
}

test("system mode follows OS live while explicit modes override it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByTestId("editor")).toHaveAttribute("data-color-scheme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("editor")).toHaveAttribute("data-color-scheme", "dark");
  await page.getByTestId("open-settings").click();
  await page.getByTestId("appearance-mode-light").check();
  await expect(page.getByTestId("editor")).toHaveAttribute("data-color-scheme", "light");
  await page.getByTestId("appearance-mode-dark").check();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByTestId("editor")).toHaveAttribute("data-color-scheme", "dark");
});


for (const mode of ["light", "dark"] as const) {
  test(`upstream code-selector fixture has a high-contrast keyboard focus ring (${mode})`, async ({ page }) => {
    await page.getByTestId("open-settings").click();
    await page.getByTestId(`appearance-mode-${mode}`).check();
    await page.getByTestId("appearance-close").click();
    // Wait for the modal's asynchronous focus restoration before focusing the CSS fixture.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("open-settings")).toBeFocused();
    // Current Folio schema does not enable supportedLanguages, so no selector is rendered.
    // Exercise the upstream selector markup in a CSS-only fixture outside ProseMirror.
    await page.evaluate(() => {
      const root = document.createElement("div"); root.className = "bn-root";
      root.innerHTML = '<div class="bn-block-content" data-content-type="codeBlock"><div><select aria-label="Test language"><option>Text</option></select></div><pre>example</pre></div>';
      root.dataset.testid = "code-focus-fixture";
      document.body.append(root);
    });
    const select = page.locator('[data-testid="code-focus-fixture"] select');
    await select.focus();
    await expect(select).toBeFocused();
    await expect(select).toHaveCSS("outline-style", "solid");
    await expect(select).toHaveCSS("outline-width", "2px");
    await expect(select).toHaveCSS("outline-color", "rgb(196, 196, 196)");
    await expect(select).toHaveCSS("opacity", "1");
    // #c4c4c4 on BlockNote's dark code surface (#161616) exceeds 10:1.
    await expect(page.locator('[data-content-type="codeBlock"]')).toHaveCSS("background-color", "rgb(22, 22, 22)");
  });
}
