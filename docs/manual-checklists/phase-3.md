# Giai đoạn 3 — Bảng phong phú: kiểm tra thủ công

## Cách chạy

1. Mở Terminal tại thư mục gốc của repo (`folio-tauri`).
2. Chạy `npm install` (lần đầu), sau đó `npm run dev`. Cửa sổ Folio tự mở.
3. Dữ liệu khi chạy `npm run dev` nằm ở `~/Library/Application Support/io.folio.app/dev/folio.sqlite` (bản cài đặt thật dùng thư mục cha, không bị đụng tới). Muốn bắt đầu lại từ trống: thoát Folio rồi xoá file đó (cùng `folio.sqlite-wal`, `folio.sqlite-shm` nếu có).

Đánh dấu `[x]` khi đạt. Mục nào hỏng: ghi ngay sau mục đó điều đã thấy.

## 1. Chèn bảng

- [ ] Gõ `/table` ở đoạn trống: slash menu lọc ra mục bảng; Enter chèn bảng (2 hàng x 3 cột), con trỏ nằm trong một ô.
- [ ] Gõ `/` trong một ô của bảng: slash menu không mở (D-022).
- [ ] Bảng là block cuối của trang: vẫn bấm được xuống dưới bảng để gõ tiếp đoạn mới.

## 2. Tay cầm và menu

- [ ] Rê chuột lên bảng: hiện tay cầm cho hàng (bên trái) và cột (phía trên), cùng nút mở rộng thêm hàng/cột.
- [ ] Bấm tay cầm hàng: menu có Thêm hàng phía trên, Thêm hàng phía dưới, Xoá hàng, và (chỉ ở hàng đầu) Hàng tiêu đề. Chữ tiếng Việt đúng, đọc được.
- [ ] Bấm tay cầm cột: menu có Thêm cột bên trái, Thêm cột bên phải, Xoá cột, và (chỉ ở cột đầu) Cột tiêu đề.
- [ ] Menu không có mục màu nền, màu chữ, tách ô hay gộp ô.
- [ ] Mục Hàng tiêu đề / Cột tiêu đề hiện dấu tick khi đang bật.

## 3. Thêm, xoá, đổi chỗ hàng và cột

- [ ] Thêm hàng phía trên và phía dưới: hàng mới xuất hiện đúng chỗ, ô trống.
- [ ] Thêm cột bên trái và bên phải: cột mới đúng chỗ, ô trống.
- [ ] Nút mở rộng ở mép bảng thêm hàng / cột ở cuối.
- [ ] Xoá một hàng giữa bảng, rồi xoá một cột giữa bảng: đúng hàng/cột bị xoá, phần còn lại giữ nguyên chữ.
- [ ] Kéo tay cầm hàng đổi chỗ hàng: hàng nằm đúng chỗ thả, chữ đi theo hàng.
- [ ] Kéo tay cầm cột đổi chỗ cột: cột nằm đúng chỗ thả, chữ đi theo cột.
- [ ] Kéo đổi chỗ cột đã được kéo giãn rộng/hẹp: độ rộng đi theo cột (D-029).
- [ ] Xoá hàng cuối cùng còn lại: cả bảng biến mất. Làm lại với bảng còn một cột và xoá cột đó: cả bảng biến mất.

## 4. Kéo giãn cột

- [ ] Kéo mép phải của một cột rộng ra: cột rộng thêm, các cột khác giữ nguyên.
- [ ] Kéo hẹp một cột hết mức: cột dừng ở mức tối thiểu, không nhỏ hơn nữa, chữ vẫn đọc được.
- [ ] Thoát Folio (⌘Q) rồi mở lại: độ rộng cột còn nguyên.

## 5. Hàng tiêu đề và cột tiêu đề

- [ ] Bật Hàng tiêu đề: hàng đầu in đậm / nền khác; tắt thì về thường. Độ rộng cột không đổi khi bật/tắt.
- [ ] Bật Cột tiêu đề: cột đầu hiện kiểu tiêu đề; tắt thì về thường.
- [ ] Bảng có hàng tiêu đề, xoá hàng đầu: hàng kế tiếp trở thành hàng tiêu đề (D-029).
- [ ] Sau đó ⌘Z một lần: trả lại cả hàng đã xoá lẫn trạng thái tiêu đề của nó (một bước duy nhất).
- [ ] Làm tương tự với cột tiêu đề: xoá cột đầu thì cột kế tiếp thành cột tiêu đề; ⌘Z một lần trả lại cả cột và trạng thái.

## 6. Phím trong ô

- [ ] Tab: sang ô kế tiếp (cuối hàng thì xuống ô đầu hàng sau).
- [ ] Shift-Tab: về ô trước.
- [ ] Tab ở ô cuối cùng của bảng: thêm một hàng mới, con trỏ vào ô đầu của hàng đó. ⌘Z một lần bỏ hàng vừa thêm.
- [ ] Enter: xuống ô cùng cột ở hàng dưới.
- [ ] Enter ở hàng cuối: thêm hàng mới, con trỏ vào ô cùng cột. ⌘Z một lần bỏ hàng vừa thêm.
- [ ] Shift-Enter: xuống dòng ngay trong ô (ô cao thêm, không sang ô khác).
- [ ] Shift-Home / Shift-End trong ô: chỉ bôi đen trong ô đó, không lan sang ô khác (D-030).
- [ ] ⌘⇧← / ⌘⇧→ trong ô: chỉ bôi đen trong ô đó. Bôi đen xong bấm ⌘B: chỉ ô đó được in đậm.
- [ ] Trong ô có nhiều dòng (Shift-Enter), Shift-Home chọn tới đầu ô chứ không phải đầu dòng. Ghi lại thấy có phiền không: ______

## 7. Định dạng và dán trong ô

- [ ] Bôi đen chữ trong ô, bấm ⌘B / ⌘I: đậm / nghiêng đúng, ⌘ lần nữa bỏ.
- [ ] Bôi đen chữ trong ô, thêm link qua thanh định dạng: chữ thành link, bấm vào mở được.
- [ ] Dán một đoạn nhiều dòng vào một ô: nội dung nằm trong ô đó (không tràn sang ô khác, không tạo bảng mới).

## 8. Hoàn tác

- [ ] Sau mỗi thao tác cấu trúc (thêm hàng, thêm cột, xoá hàng, xoá cột, đổi chỗ hàng, đổi chỗ cột, bật/tắt tiêu đề): ⌘Z một lần chỉ lùi đúng một bước; ⇧⌘Z làm lại đúng bước đó.
- [ ] Bảng vẫn hiện đúng chỗ trên trang sau khi hoàn tác (không nhảy về góc trên trái).

## 9. Tìm kiếm

- [ ] ⌘F: tìm một chữ nằm trong ô bảng, ra kết quả và tô sáng đúng chữ.
- [ ] Tìm kiếm ở thanh bên: chữ nằm trong ô bảng cho ra đúng trang đó.

## 10. Dữ liệu cũ

- [ ] Mở lại Folio sau khi cập nhật (không xoá dữ liệu dev): các trang và ghi chú từ Giai đoạn 1–2 vẫn mở được, không mất nội dung, không báo lỗi.
- [ ] Trang cũ có bảng (chèn từ Giai đoạn 2) vẫn hiện đúng và sửa được.

## 11. Gõ tiếng Việt trong bảng (bắt buộc)

Câu thử: `Tiếng Việt có dấu: Đà Nẵng, Huế, người, được, ở`

Làm với **hai** bộ gõ: (A) Telex có sẵn của macOS, (B) EVKey hoặc OpenKey (ghi tên bộ gõ: ______).
Đạt = chữ không bị cắt, không bị nhân đôi, không mất ký tự; không có menu hay thanh công cụ bật lên giữa chữ.

- [ ] Gõ câu thử trong một ô bảng: đủ chữ, đủ dấu. (A ☐, B ☐)
- [ ] Gõ một từ có dấu (ví dụ `nguwowif` rồi chốt) rồi bấm Tab ngay: từ vào ô cũ nguyên vẹn, con trỏ sang ô kế, không chữ nào rơi sang ô mới. (A ☐, B ☐)
- [ ] Gõ một từ có dấu rồi bấm Enter ngay: từ ở lại ô cũ nguyên vẹn, con trỏ xuống ô dưới. (A ☐, B ☐)
- [ ] Gõ câu thử trong hàng tiêu đề (đang bật Hàng tiêu đề): đủ chữ, đủ dấu, không lặp. (A ☐, B ☐)
- [ ] Đang gõ dở một chữ (chưa chốt, còn gạch chân ghép) thì bấm Tab: chữ không bị cắt hay nhân đôi. (A ☐, B ☐)
- [ ] Đang gõ dở một chữ thì bấm Enter: chữ không bị cắt hay nhân đôi; Enter không thêm hàng ngoài ý muốn. (A ☐, B ☐)
- [ ] Gõ chữ có dấu ở ô cuối cùng rồi Tab (thêm hàng): chữ ở lại ô cuối, hàng mới trống. (A ☐, B ☐)
- [ ] Chế độ "sửa lỗi trình duyệt" (browser fix) của EVKey/OpenKey khi gõ trong ô: không mất chữ, không nhấp nháy. (B ☐)

Kết luận: [ ] Đạt hết  [ ] Có mục hỏng (ghi số mục): ______
