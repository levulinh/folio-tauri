/** Every user-visible string (tech spec §5.13). Components never inline text. */
export const vi = {
  untitled: "Không có tiêu đề",
  newPage: "Trang mới",
  newSubpage: "Thêm trang con",
  rename: "Đổi tên",
  delete: "Xoá",
  confirmDeletePage: (title: string, descendants: number) =>
    `Xoá trang “${title}”${descendants > 0 ? ` và ${descendants} trang con` : ""}? Không thể hoàn tác.`,
  emptyState: "Chưa có trang nào.",
  createFirstPage: "Tạo trang đầu tiên",
  searchPlaceholder: "Tìm kiếm",
  noResults: "Không tìm thấy kết quả",
  saved: "Đã lưu",
  saving: "Đang lưu…",
  saveError: "Lỗi lưu — đang thử lại",
  find: "Tìm trong trang",
  findNoMatch: "Không có kết quả",
  findNext: "Kết quả sau",
  findPrev: "Kết quả trước",
  findClose: "Đóng",
  errors: {
    not_found: "Không tìm thấy mục này",
    invalid_op: "Thao tác không hợp lệ",
    last_tab: "Trang phải có ít nhất một tab",
    empty_comment: "Bình luận không được để trống",
    db: "Lỗi cơ sở dữ liệu",
    io: "Lỗi đọc ghi file",
    json: "Dữ liệu bị lỗi",
    saveFailed: "Chưa lưu được, đang thử lại",
  },
  // Not in §5.13's table; needed by the Phase 1 shell (see docs/decisions.md D-012).
  pagesSection: "Trang",
  cancel: "Huỷ",
  moreActions: "Tuỳ chọn",
  expand: "Mở rộng",
  collapse: "Thu gọn",
} as const;

export type ErrorCode = keyof typeof vi.errors;
