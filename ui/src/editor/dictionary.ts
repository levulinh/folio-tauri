import { en, vi as viLocale } from "@blocknote/core/locales";

export const dictionary = {
  ...viLocale,
  // The slash menu stays English (tech spec §5.7 / §5.13).
  slash_menu: en.slash_menu,
  placeholders: {
    ...viLocale.placeholders,
    default: "Nhập '/' để chọn lệnh",
    heading: "Tiêu đề",
    bulletListItem: "Danh sách",
    numberedListItem: "Danh sách",
    checkListItem: "Việc cần làm",
  },
};
