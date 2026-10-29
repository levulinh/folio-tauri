# Kiểm tra giao diện Folio

Nhánh: `codex/appearance`. Chạy `npm run dev` tại `~/Workspace/personal/folio-tauri` (nếu app đang chạy, giao diện có thể đã cập nhật qua HMR). Để kiểm tra menu Rust mới, thoát bình thường rồi chạy lại dev. Dữ liệu dev ở `~/Library/Application Support/io.folio.app/dev/folio.sqlite`.

Các mục dưới đây là kiểm tra tay **chưa được xác nhận**; bộ test tự động không thay thế việc gõ bằng bộ gõ thật.

## Bố cục
- [ ] Sidebar có Folio, tìm kiếm, cây trang; Trang mới và Cài đặt ở dưới. Không có nền xanh pha vào toàn trang.
- [ ] Tiêu đề và nội dung thẳng hàng; trạng thái lưu ở góc phải đầu trang. Đường dẫn hiện đúng tên trang và trang cha.
- [ ] Thu cửa sổ xuống 800×500: nút Trang mới/Cài đặt còn dùng được, không tràn ngang cả trang; bảng rộng cuộn riêng.
- [ ] Tiêu đề dài, tên có dấu/emoji và cây trang sâu vẫn hiện được nút thêm/đổi tên/xoá.
- [ ] Kéo mép trên cửa sổ vẫn di chuyển; nhấp đúp vẫn phóng to/thu lại.

## Cài đặt
- [ ] Bấm Cài đặt khi chưa có trang hoặc khi đang mở trang đều hiện đúng một hộp thoại.
- [ ] Menu Folio → Cài đặt… và ⌘, mở cùng hộp thoại. Không mở hai hộp khi gọi liên tục.
- [ ] Tab/Shift-Tab chỉ di chuyển trong hộp thoại; Escape/nút ×/bấm ngoài đóng được và trả focus về nơi mở.
- [ ] Chọn Theo hệ thống/Sáng/Tối: cả app, editor, menu nổi đổi cùng nhau. Sáng/Tối cố định không đổi theo OS.
- [ ] Chọn Theo hệ thống rồi đổi OS sáng/tối: Folio đổi theo mà không cần khởi động lại. Sau thử, trả OS về lựa chọn ban đầu.
- [ ] Thử Trung tính/Xanh dương/Olive/Tím trong cả sáng và tối: vùng chọn/điều khiển đổi, nền vẫn trung tính.
- [ ] Màu chữ tự soạn, link, thông báo lỗi và trạng thái không bị đổi sang màu nhấn tùy ý.
- [ ] Đổi màu nhanh nhiều lần, đóng/mở Cài đặt rồi thoát app bình thường/mở lại: giữ lựa chọn cuối đã lưu.
- [ ] Khi Cài đặt đang mở, ⌘N, ⌘F, tìm mọi trang và Hoàn tác không tác động tới ghi chú nằm phía sau.

## Tiếng Việt và an toàn dữ liệu
Dùng Telex macOS và EVKey/OpenKey đang dùng. Câu thử: `Tiếng Việt có dấu: Đà Nẵng, Huế, người, được, ở`.
- [ ] Gõ trong tiêu đề, đoạn văn và ô bảng trước/sau đổi giao diện: không lặp/mất chữ/dấu.
- [ ] Gọi Cài đặt trong lúc đang ghép chữ: chữ được chốt bình thường rồi hộp thoại mới mở; không cướp bộ gõ.
- [ ] Escape dùng để huỷ ghép chữ không đóng hộp thoại nhầm.
- [ ] Gõ rồi mở Cài đặt/đổi theme ngay: trở lại editor còn nguyên chữ, vùng chọn và lịch sử hoàn tác.
- [ ] Một lần ⌘Z chỉ lùi một bước; thử menu Sửa → Hoàn tác, sau đó gõ tiếp trong bảng.
- [ ] Gõ rồi ⌘Q hoặc Dock → Thoát: mở lại còn chữ. Lựa chọn giao diện đã lưu cũng còn nguyên.

## Lỗi lưu (test giả lập tự động; không phá database thật)
- [ ] Nếu thấy lỗi lưu giao diện: bản xem vẫn giữ lựa chọn vừa chọn, có thông báo và nút Thử lại; app không báo Đã lưu giả.
- [ ] Sau Thử lại thành công, mở lại vẫn đúng lựa chọn; lỗi giao diện không chặn lưu ghi chú.

Tự động đã kiểm tra: 12 tổ hợp cấu hình, sửa trong lúc load/save, lỗi ghi/đọc, retry, sidebar/menu giả lập, trap focus, màu trên các nền thật, đổi theme giữa lúc lưu và không tạo lại editor. Native menu, ghép chữ thật và kéo cửa sổ cần anh kiểm tra ở trên.
