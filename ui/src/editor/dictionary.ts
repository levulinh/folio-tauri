import { en, vi as viLocale } from "@blocknote/core/locales";

/**
 * BlockNote's UI strings: the 0.56 Vietnamese locale, the slash menu in English (tech spec
 * §5.7 / §5.13), and Folio's own wording on top (decisions D-025).
 */
export const dictionary = {
  ...viLocale,
  slash_menu: en.slash_menu,
  placeholders: {
    ...viLocale.placeholders,
    default: "Nhập '/' để chọn lệnh",
    heading: "Tiêu đề",
    bulletListItem: "Danh sách",
    numberedListItem: "Danh sách",
    checkListItem: "Việc cần làm",
  },
  formatting_toolbar: {
    ...viLocale.formatting_toolbar,
    bold: { ...viLocale.formatting_toolbar.bold, tooltip: "Đậm" },
    italic: { ...viLocale.formatting_toolbar.italic, tooltip: "Nghiêng" },
    underline: { ...viLocale.formatting_toolbar.underline, tooltip: "Gạch chân" },
    // The vi locale says Mod+Shift+X; BlockNote binds strike to Mod+Shift+S (as the en locale says).
    strike: { tooltip: "Gạch ngang", secondary_tooltip: en.formatting_toolbar.strike.secondary_tooltip },
    code: { ...viLocale.formatting_toolbar.code, tooltip: "Code" },
    link: { ...viLocale.formatting_toolbar.link, tooltip: "Liên kết" },
  },
  link_toolbar: {
    ...viLocale.link_toolbar,
    delete: { tooltip: "Xoá liên kết" },
  },
  side_menu: {
    ...viLocale.side_menu,
    drag_handle_label: "Mở menu khối",
  },
  drag_handle: {
    ...viLocale.drag_handle,
    delete_menuitem: "Xoá",
    header_row_menuitem: "Hàng tiêu đề",
    header_column_menuitem: "Cột tiêu đề",
  },
  table_handle: {
    ...viLocale.table_handle,
    add_above_menuitem: "Thêm hàng phía trên",
    add_below_menuitem: "Thêm hàng phía dưới",
    add_left_menuitem: "Thêm cột bên trái",
    add_right_menuitem: "Thêm cột bên phải",
    delete_column_menuitem: "Xoá cột",
    delete_row_menuitem: "Xoá hàng",
  },
};
