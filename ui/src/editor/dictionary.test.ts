import { en } from "@blocknote/core/locales";
import { expect, it } from "vitest";
import { dictionary } from "./dictionary";

const SHOWN_SECTIONS = ["formatting_toolbar", "link_toolbar", "side_menu", "drag_handle", "table_handle", "suggestion_menu"] as const;
/** Identical in both languages on purpose. */
const SAME_AS_ENGLISH = new Set(["Code"]);
/** Keyboard shortcuts ("Mod+B", "Tab", ...) and the empty string are not translated. */
const SHORTCUT = /^(Mod\+|Shift\+|Tab$|$)/;
const isShortcut = (path: string, text: string) => path.endsWith("secondary_tooltip") && SHORTCUT.test(text);

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

it("link toolbar delete is Xoá liên kết", () => {
  expect(dictionary.link_toolbar.delete.tooltip).toBe("Xoá liên kết");
});

it("drag menu delete is Xoá", () => {
  expect(dictionary.drag_handle.delete_menuitem).toBe("Xoá");
});

it("table menus are Vietnamese", () => {
  const t = dictionary.table_handle;
  expect(t.add_above_menuitem).toBe("Thêm hàng phía trên");
  expect(t.add_below_menuitem).toBe("Thêm hàng phía dưới");
  expect(t.add_left_menuitem).toBe("Thêm cột bên trái");
  expect(t.add_right_menuitem).toBe("Thêm cột bên phải");
  expect(t.delete_row_menuitem).toBe("Xoá hàng");
  expect(t.delete_column_menuitem).toBe("Xoá cột");
  expect(dictionary.drag_handle.header_row_menuitem).toBe("Hàng tiêu đề");
  expect(dictionary.drag_handle.header_column_menuitem).toBe("Cột tiêu đề");
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
    ([path, text]) => !isShortcut(path, text) && !SAME_AS_ENGLISH.has(text) && english.get(path) === text,
  );
  expect(untranslated).toEqual([]);
});
