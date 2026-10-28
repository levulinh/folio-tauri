import { en } from "@blocknote/core/locales";
import { expect, it } from "vitest";
import { dictionary } from "./dictionary";

const SHOWN_SECTIONS = ["formatting_toolbar", "link_toolbar", "side_menu", "drag_handle", "suggestion_menu"] as const;
/** Identical in both languages on purpose. */
const SAME_AS_ENGLISH = new Set(["Code"]);
/** Keyboard shortcuts ("Mod+B", "Tab", ...) and the empty string are not translated. */
const isShortcut = (path: string) => path.endsWith("secondary_tooltip");

function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [];
}

it("slash menu stays English", () => {
  expect(dictionary.slash_menu).toEqual(en.slash_menu);
});

it("toolbar tooltips are Vietnamese", () => {
  const t = dictionary.formatting_toolbar;
  expect(t.bold.tooltip).toBe("Đậm");
  expect(t.italic.tooltip).toBe("Nghiêng");
  expect(t.underline.tooltip).toBe("Gạch chân");
  expect(t.strike.tooltip).toBe("Gạch ngang");
  expect(t.code.tooltip).toBe("Code");
  expect(t.link.tooltip).toBe("Liên kết");
});

it("strike shortcut hint matches BlockNote's real binding", () => {
  expect(dictionary.formatting_toolbar.strike.secondary_tooltip).toBe("Mod+Shift+S");
});

it("drag menu delete is Xoá", () => {
  expect(dictionary.drag_handle.delete_menuitem).toBe("Xoá");
});

it("keeps the Folio placeholders", () => {
  expect(dictionary.placeholders.default).toBe("Nhập '/' để chọn lệnh");
  expect(dictionary.placeholders.heading).toBe("Tiêu đề");
  expect(dictionary.placeholders.bulletListItem).toBe("Danh sách");
  expect(dictionary.placeholders.numberedListItem).toBe("Danh sách");
  expect(dictionary.placeholders.checkListItem).toBe("Việc cần làm");
});

it("no shown section is left in English", () => {
  const english = new Map(SHOWN_SECTIONS.flatMap((s) => leaves(en[s], s)));
  const untranslated = SHOWN_SECTIONS.flatMap((s) => leaves(dictionary[s], s)).filter(
    ([path, text]) => !isShortcut(path) && !SAME_AS_ENGLISH.has(text) && english.get(path) === text,
  );
  expect(untranslated).toEqual([]);
});
