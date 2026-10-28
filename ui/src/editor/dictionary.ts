import { vi as viLocale } from "@blocknote/core/locales";

export const dictionary = {
  ...viLocale,
  placeholders: {
    ...viLocale.placeholders,
    default: "Nhập '/' để chọn lệnh",
    heading: "Tiêu đề",
    bulletListItem: "Danh sách",
    numberedListItem: "Danh sách",
    checkListItem: "Việc cần làm",
  },
};
