# Giai đoạn 2 — Điều khiển soạn thảo: kiểm tra thủ công

## Cách chạy

1. Mở Terminal tại thư mục gốc của repo (`folio-tauri`).
2. Chạy `npm install` (lần đầu), sau đó `npm run dev`. Cửa sổ Folio tự mở.
3. Dữ liệu khi chạy `npm run dev` nằm ở `~/Library/Application Support/io.folio.app/dev/folio.sqlite` (bản cài đặt thật dùng thư mục cha, không bị đụng tới). Muốn bắt đầu lại từ trống: thoát Folio rồi xoá file đó (cùng `folio.sqlite-wal`, `folio.sqlite-shm` nếu có).

Đánh dấu `[x]` khi đạt. Mục nào hỏng: ghi ngay sau mục đó điều đã thấy.

## 1. Bố cục

- [ ] Cột chữ rộng, đọc thoải mái (không bị bó hẹp như Giai đoạn 1).
- [ ] Vùng soạn thảo không có nền riêng: cùng màu nền với phần còn lại của trang.
- [ ] Lề trái của chữ thẳng hàng với lề trái của ô tiêu đề.
- [ ] Kéo hẹp cửa sổ hết cỡ cho phép: chữ vẫn xuống dòng gọn, không tràn, không bị che bởi thanh bên.
- [ ] Đổi macOS sang chế độ sáng rồi tối: bố cục và màu chữ vẫn đọc được ở cả hai.

## 2. Thanh định dạng

- [ ] Bôi đen một đoạn chữ: thanh định dạng hiện ra gần vùng chọn và chỉ có đúng 6 nút.
- [ ] Bấm một nút trên thanh: vùng chọn và con trỏ vẫn còn trong editor (không bị mất focus), định dạng áp dụng ngay.
- [ ] Đang bôi đen mà gõ chữ: thanh ẩn đi.
- [ ] Bôi đen chữ trong khối mã (code block): thanh định dạng không hiện.
- [ ] ⌘A trong trang trống: thanh định dạng không hiện.
- [ ] Bôi đen chữ, bấm ra ngoài (bỏ vùng chọn), rồi bôi đen lại: thanh hiện lại.
- [ ] Bấm Escape khi thanh đang hiện: thanh đóng.
- [ ] Rê chuột lên từng nút: tooltip tiếng Việt, đọc được, không lỗi chữ.

## 3. ⌘B / ⌘I / ⌘U

- [ ] Có vùng chọn: ⌘B làm đậm, ⌘B lần nữa bỏ đậm.
- [ ] Có vùng chọn: ⌘I làm nghiêng, ⌘I lần nữa bỏ nghiêng.
- [ ] Có vùng chọn: ⌘U gạch chân, ⌘U lần nữa bỏ gạch chân.
- [ ] Không có vùng chọn (chỉ có con trỏ): ⌘B rồi gõ chữ — chữ mới đậm; ⌘B lần nữa rồi gõ — chữ mới thường. Tương tự với ⌘I và ⌘U.

## 4. Slash menu

- [ ] Gõ `/` ở đoạn trống: menu mở; nhãn các mục bằng tiếng Anh (ví dụ Heading 1, Bullet List) — đúng thiết kế.
- [ ] Gõ `/head`: danh sách lọc còn các mục tiêu đề.
- [ ] Mũi tên lên/xuống đổi mục chọn; Enter chèn đúng khối đã chọn.
- [ ] Escape đóng menu, không chèn gì, `/` vẫn nằm trong văn bản.
- [ ] Chọn mục chèn bảng: bảng xuất hiện, con trỏ nằm trong một ô.
- [ ] Gõ `/` trong một ô của bảng: slash menu không mở (D-022).
- [ ] Gõ `/` trong khối mã: slash menu không mở.

## 5. Nút + và ⋮⋮

- [ ] Rê chuột lên một block: hiện nút + và tay nắm ⋮⋮ bên trái block đó.
- [ ] Bắt đầu gõ: hai nút ẩn đi; di chuyển chuột lại thì hiện lại.
- [ ] Bấm nút +: chèn một đoạn trống bên dưới và mở slash menu.
- [ ] Bấm ⋮⋮: menu chỉ có đúng một mục **Xoá**; chữ tiếng Việt, đọc được. Bấm Xoá thì block biến mất.
- [ ] Tooltip của + và ⋮⋮ bằng tiếng Việt.

## 6. Kéo thả block

- [ ] Kéo một block bằng ⋮⋮: thấy bóng mờ của block đi theo chuột.
- [ ] Trong lúc kéo: có đường kẻ xanh đúng chỗ sẽ thả; di chuột lên/xuống thì đường kẻ dời theo.
- [ ] Thả: block nằm đúng vị trí đường kẻ xanh.
- [ ] Tạo danh sách có mục con (ít nhất 2 mục, một mục có con). Kéo mục cha xuống dưới vài block: các mục con đi theo.
- [ ] Sau kéo thả, ⌘Z một lần: hoàn tác đúng lần kéo (mục cha và con về chỗ cũ).
- [ ] Sau kéo thả, thoát Folio (⌘Q) rồi mở lại: thứ tự block đúng như vừa thả (không về chỗ cũ, không mất, không lặp). Làm thêm: kéo, ⌘Z, thoát, mở lại — thứ tự là thứ tự đã hoàn tác.
- [ ] Gõ chữ ngay sau khi kéo thả: chữ vào đúng chỗ, không mất, không lặp.

## 7. Hoàn tác an toàn (D-024, D-026)

Trước đây một lần ⌘Z có thể xoá sạch cả trang. Chuẩn bị: tạo một trang, gõ ba đoạn văn khác nhau trong editor, cách nhau vài giây.

- [ ] (a) Bấm vào thanh bên (một vùng trống hoặc một trang khác rồi quay lại) rồi ⌘Z: nội dung trang không đổi.
- [ ] (b) Bấm vào ô tiêu đề rồi ⌘Z: nội dung trang không bị xoá.
- [ ] (c) ⌘Z trong từng ô sau chỉ hoàn tác trong chính ô đó, nội dung trang không đổi:
  - [ ] ô tìm trong trang (⌘F)
  - [ ] ô tìm kiếm ở thanh bên
  - [ ] ô đổi tên trên thanh bên
  - [ ] ô nhập link
- [ ] (d) Gõ chữ vào tiêu đề, rồi gõ chữ trong editor, rồi quay lại tiêu đề bấm ⌘Z. Ghi lại chuyện gì xảy ra (đã biết có thể không hoàn tác được tiêu đề): ______
- [ ] (e) Trong editor, bấm menu **Sửa → Hoàn tác** bằng chuột ba lần liên tiếp: mỗi lần lùi đúng một bước. Rồi **Sửa → Làm lại** ba lần: trở lại đủ nội dung.
- [ ] (f) Đang gõ dở một chữ Telex/EVKey (ví dụ `nguwowi`, chưa chốt) thì bấm ⌘Z: chữ không bị nhân đôi, không mất ký tự. Làm với cả Telex macOS và EVKey/OpenKey.
- [ ] (g) Sau khi kéo thả một block, ⌘Z một lần hoàn tác đúng lần kéo; thoát rồi mở lại vẫn đúng.

## 8. Escape trong editor

- [ ] Khi thanh ⌘F đang mở và con trỏ ở editor: Escape đóng thanh tìm.
- [ ] Khi menu emoji đang mở: Escape chỉ đóng menu emoji, thanh ⌘F (nếu đang mở) vẫn còn.

## 9. Gõ tiếng Việt với các điều khiển mới (bắt buộc)

Câu thử: `Tiếng Việt có dấu: Đà Nẵng, Huế, người, được, ở`

Làm với **hai** bộ gõ: (A) Telex có sẵn của macOS, (B) EVKey hoặc OpenKey (ghi tên bộ gõ: ______).
Đạt = không mất chữ, không lặp chữ, không có menu hay thanh công cụ bật lên giữa chữ.

- [ ] Gõ câu thử trong đoạn văn, bôi đen một chữ có dấu (ví dụ `Nẵng`), bấm ⌘B: chữ đậm, đủ dấu, không vỡ. (A ☐, B ☐)
- [ ] Gõ `/` ngay sau một chữ đang ghép dở (ví dụ `nguwowif` chưa chốt rồi `/`): slash menu không bật giữa chữ, chữ không hỏng. (A ☐, B ☐)
- [ ] Mở slash menu ở đoạn trống rồi lọc bằng chữ có dấu (ví dụ `/bảng`, `/tiêu`): bộ gõ không vỡ, không mất chữ. (A ☐, B ☐)
- [ ] Kéo thả một block rồi gõ ngay tiếng Việt: chữ vào đúng chỗ, bộ gõ không bị vỡ. (A ☐, B ☐)

Kết luận: [ ] Đạt hết  [ ] Có mục hỏng (ghi số mục): ______
