# Giai đoạn 0 — Kiểm tra gõ tiếng Việt

Chạy: `cd spikes/ime && npm install && npm run tauri dev`

Câu thử: `Tiếng Việt có dấu: Đà Nẵng, Huế, người, được, ở`

Làm mỗi mục với **hai** bộ gõ: (A) Telex có sẵn của macOS, (B) EVKey hoặc OpenKey (ghi tên bộ gõ).
Đạt = không mất chữ, không lặp chữ, không có menu/thanh công cụ bật lên giữa chữ.

| # | Việc | A | B | Ghi chú |
|---|---|---|---|---|
| 1 | Gõ câu thử vào đoạn văn trống | ☐ | ☐ | |
| 2 | Gõ câu thử vào dòng "Tiêu đề" | ☐ | ☐ | |
| 3 | Gõ câu thử vào dòng "Danh sách", Enter, gõ tiếp ở dòng mới | ☐ | ☐ | |
| 4 | Gõ câu thử vào một ô bảng, Tab sang ô kế, gõ tiếp | ☐ | ☐ | |
| 5 | Gõ `/` rồi gõ `tiêu đề` để lọc menu (menu phải lọc đúng, không đóng/mở lung tung) | ☐ | ☐ | |
| 6 | Đang gõ dở chữ `người` thì bấm ⌘B, gõ tiếp | ☐ | ☐ | |
| 7 | Gõ câu thử vào ô textarea cuối trang | ☐ | ☐ | |
| 8 | Gõ câu thử vào ô "Ô tìm kiếm thử" | ☐ | ☐ | |
| 9 | Gõ `Đà Nẵng` rồi ⌘Z: ghi lại ⌘Z xoá cả chữ hay từng dấu | ☐ | ☐ | |
| 10 | Bôi đen chữ có dấu, bấm ⌘B, ⌘I, ⌘U | ☐ | ☐ | |

Kết luận: ☐ Đạt hết  ☐ Có mục hỏng (ghi số mục): ____
