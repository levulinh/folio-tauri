# Giai đoạn 1 — Bộ khung: kiểm tra thủ công

## Cách chạy

1. Mở Terminal tại thư mục gốc của repo (`folio-tauri`).
2. Chạy `npm install` (lần đầu), sau đó `npm run dev`. Lần đầu build Rust mất vài phút; cửa sổ Folio tự mở.
3. Khi chạy `npm run dev`, dữ liệu nằm ở `~/Library/Application Support/io.folio.app/dev/folio.sqlite` (bản cài đặt thật dùng thư mục cha, không bị đụng tới). Muốn bắt đầu lại từ trống: thoát Folio rồi xoá file đó (cùng `folio.sqlite-wal`, `folio.sqlite-shm` nếu có).

Đánh dấu `[x]` khi đạt. Mục nào hỏng: ghi ngay sau mục đó điều đã thấy.

## 1. Trang

- [ ] Lần đầu mở (dữ liệu trống): thấy màn hình trống với nút tạo trang đầu tiên; bấm nút đó → có một trang "Không có tiêu đề" và ô tiêu đề đang nhấp nháy con trỏ.
- [ ] Menu **Tệp → Trang mới** (hoặc ⌘N): có trang mới ở cuối danh sách bên trái, được mở ngay, con trỏ nằm trong ô tiêu đề (gõ được luôn, không cần bấm).
- [ ] Bấm nút "+ Trang mới" cuối thanh bên: cũng ra trang mới với con trỏ ở ô tiêu đề.
- [ ] Đang mở một trang, menu **Tệp → Trang con mới** (⇧⌘N): có trang con thụt vào dưới trang đang mở, cha tự mở rộng, trang con được mở và con trỏ ở ô tiêu đề.
- [ ] Chưa mở trang nào (xoá hết trang, hoặc mới mở lại app mà chưa chọn trang): Trang con mới không làm gì cả.
- [ ] Rê chuột lên một dòng trang rồi bấm nút "+" của dòng đó: có trang con mới thụt vào dưới dòng đó.
- [ ] Bấm mũi tên ở đầu dòng cha để thu gọn/mở rộng; thoát app mở lại — trạng thái thu gọn/mở rộng vẫn như cũ.
- [ ] Đổi tên từ thanh bên: rê chuột → nút "…" → Đổi tên, gõ tên mới, Enter → tên đổi cả ở thanh bên và ở ô tiêu đề trang.
- [ ] Đổi tên, gõ dở rồi bấm Esc: tên cũ được giữ.
- [ ] Đổi tên ngay trong ô tiêu đề của trang, bấm sang chỗ khác: thanh bên cập nhật tên mới.
- [ ] Xoá: nút "…" → Xoá → hộp thoại xác nhận hiện ra, nói rõ nếu có trang con ("và N trang con"). Bấm Huỷ → trang còn nguyên. Làm lại, bấm nút "Xoá" trong hộp thoại → trang và các trang con biến mất.
- [ ] Xoá hết các trang: quay lại màn hình trống ban đầu.

## 2. Phím tắt Markdown (gõ ở dòng trống đầu tiên của trang)

- [ ] `# ` + chữ → Tiêu đề 1.
- [ ] `## ` + chữ → Tiêu đề 2.
- [ ] `### ` + chữ → Tiêu đề 3.
- [ ] `- ` + chữ → danh sách chấm.
- [ ] `1. ` + chữ → danh sách số.
- [ ] `[] ` + chữ → ô việc cần làm (tick được).
- [ ] `> ` + chữ → trích dẫn.
- [ ] ` ``` ` (ba dấu huyền) + dấu cách → khối mã.
- [ ] Enter và Backspace theo quy tắc Notion: Enter ở cuối một mục danh sách tạo mục mới; Enter trên mục danh sách trống thoát khỏi danh sách thành đoạn văn; Backspace ở đầu một mục danh sách/tiêu đề biến nó về đoạn văn; Backspace ở đầu đoạn văn nối vào dòng trên.
- [ ] Enter ở cuối tiêu đề (H1–H3) tạo đoạn văn mới bên dưới, không phải tiêu đề.
- [ ] Danh sách lồng nhau: ở mục thứ hai trở đi bấm Tab → thụt vào làm con của mục trên; Shift-Tab → ra lại cấp ngoài. Mục con đi theo mục cha khi thụt/ra.
- [ ] Mỗi loại khối ở trên vẫn đúng sau khi thoát app và mở lại.

## 3. Lưu khi thoát

- [ ] Gõ `Đà Nẵng mùa hè` vào đoạn văn rồi bấm ⌘Q **ngay lập tức** (không chờ). Mở lại app, mở trang đó: chữ còn nguyên.
- [ ] Gõ chữ rồi bấm nút đỏ đóng cửa sổ **ngay lập tức**. Mở lại app (hoặc bấm icon Dock): chữ còn nguyên.
- [ ] Gõ chữ rồi thoát bằng Dock ngay: chuột phải icon Folio trên Dock → Thoát. Mở lại: chữ còn nguyên.
- [ ] Gõ tên mới vào ô tiêu đề rồi thoát ngay bằng ⌘Q (không bấm ra ngoài, không chờ): mở lại, tên mới còn nguyên.
- [ ] Gõ ở trang A rồi bấm ngay sang trang B ở thanh bên: quay lại trang A, chữ còn nguyên.
- [ ] Thoát app mất không quá vài giây, không treo.

## 4. Tìm kiếm trong thanh bên

- [ ] Có trang tên `Đà Nẵng`. Gõ `da nang` vào ô tìm kiếm: trang `Đà Nẵng` hiện trong kết quả (tìm không dấu ra có dấu).
- [ ] Có trang mà nội dung (không phải tiêu đề) chứa `Đà Nẵng`: gõ `da nang` cũng ra trang đó.
- [ ] Tìm `e-mail`: ra đúng trang chứa chữ `e-mail`.
- [ ] Tìm `don't`: ra đúng trang chứa chữ `don't`.
- [ ] Tìm chữ không có ở đâu (ví dụ `zzzz`): hiện "Không tìm thấy kết quả".
- [ ] Gõ `da nang` rồi Enter ngay: mở trang kết quả đầu tiên.
- [ ] Bấm Esc trong ô tìm kiếm: ô được xoá và cây trang hiện lại.
- [ ] ⇧⌘F (menu **Sửa → Tìm mọi trang**): con trỏ nhảy vào ô tìm kiếm ở thanh bên.

## 5. Tìm trong trang (⌘F)

- [ ] ⌘F (menu **Sửa → Tìm trong trang**) mở thanh tìm ở đầu trang, con trỏ nằm trong ô tìm.
- [ ] Gõ chữ có trong trang: các chỗ khớp được tô sáng, có đếm số kết quả; Enter/Shift-Enter chuyển qua lại.
- [ ] Gõ `Đà Nẵng` (hoặc `da nang`): chữ có dấu được tô sáng **trọn chữ** (không bị cắt mất dấu hay nửa chữ).
- [ ] Esc đóng thanh tìm và bỏ tô sáng.

## 6. Menu và giao diện

- [ ] Thanh menu hiển thị tiếng Việt: Folio (Giới thiệu, Ẩn, Thoát Folio), Tệp (Trang mới, Trang con mới), Sửa (Hoàn tác, Làm lại, Cắt, Sao chép, Dán, Chọn tất cả, Tìm trong trang, Tìm mọi trang). Không có chữ tiếng Anh nào.
- [ ] Gõ `/` ở đoạn trống: mở menu khối (slash menu); nhãn các mục bằng tiếng Anh (ví dụ Heading 1, Bullet List) — đúng như thiết kế giai đoạn này.
- [ ] Đổi macOS sang chế độ sáng rồi tối (Cài đặt hệ thống → Giao diện): Folio đổi theo ngay, chữ vẫn đọc được ở cả hai.

## 7. Gõ tiếng Việt (bắt buộc)

Câu thử: `Tiếng Việt có dấu: Đà Nẵng, Huế, người, được, ở`

Làm từng mục với **hai** bộ gõ: (A) Telex có sẵn của macOS, (B) EVKey hoặc OpenKey (ghi tên bộ gõ: ______).
Đạt = không mất chữ, không lặp chữ, không có menu hay thanh công cụ bật lên giữa chữ; ⌘Z xoá cả từ chứ không phải từng dấu (nếu khác, ghi lại ⌘Z làm gì).

Với mỗi chỗ dưới đây: A ☐  B ☐

- [ ] Tiêu đề trang (A ☐, B ☐)
- [ ] Đoạn văn (A ☐, B ☐)
- [ ] Tiêu đề H1 (A ☐, B ☐)
- [ ] Tiêu đề H2 (A ☐, B ☐)
- [ ] Tiêu đề H3 (A ☐, B ☐)
- [ ] Danh sách: gõ câu thử, Enter, gõ tiếp ở mục mới (A ☐, B ☐)
- [ ] Ô tìm kiếm ở thanh bên (A ☐, B ☐)
- [ ] Ô tìm trong trang (⌘F) (A ☐, B ☐)
- [ ] Ô tiêu đề: gõ Telex rồi bấm Enter để chốt chữ đang gõ dở (ví dụ `nguwowif` rồi Enter) — con trỏ **không** nhảy xuống phần soạn thảo; Enter lần nữa (khi không còn chữ gõ dở) thì mới nhảy xuống.
- [ ] Gõ `/` giữa lúc đang gõ dở một chữ: không mở slash menu giữa chữ, chữ không bị hỏng.
- [ ] Gõ `Đà Nẵng` rồi ⌘Z: ghi lại ⌘Z xoá cả chữ hay từng dấu: ______

Kết luận: [ ] Đạt hết  [ ] Có mục hỏng (ghi số mục): ______

## 8. Tình huống khó (bổ sung sau rà soát cuối Giai đoạn 1)

- [ ] Gõ tiếng Việt trong editor khi thanh ⌘F đang mở và đang tô sáng kết quả: mở trang có chữ `nang`, bấm ⌘F, gõ `nang` (có tô sáng), rồi bấm vào editor và gõ `Đà Nẵng` bằng Telex. Mong đợi: không mất chữ, không lặp chữ, tô sáng không làm hỏng chữ đang gõ dở, con trỏ không nhảy. Ghi lại điều đã thấy: ______
- [ ] Telex/EVKey khi đổi tên trang ngay trên thanh bên: nút "…" → Đổi tên, gõ `nguwowif` (Telex) rồi bấm Enter để chốt chữ. Mong đợi: ô đổi tên vẫn mở, chữ được chốt thành `người`; Enter lần nữa (khi không còn chữ gõ dở) mới kết thúc đổi tên. Làm tiếp: gõ dở một chữ rồi bấm Esc → Esc chỉ huỷ chữ gõ dở, ô đổi tên vẫn mở; Esc lần nữa mới huỷ đổi tên (tên cũ được giữ). Làm với cả Telex của macOS và EVKey/OpenKey.
- [ ] Bấm chuột vào menu **Sửa → Hoàn tác** và **Sửa → Làm lại** khi con trỏ đang ở trong editor (gõ vài chữ trước). Ghi lại nó có hoàn tác/làm lại đúng không (cùng kết quả với ⌘Z / ⇧⌘Z?): ______
- [ ] Tạo trang A với vài block (đoạn văn, danh sách lồng nhau, tiêu đề). Chọn vài block, ⌘C, mở trang B (trang trống), ⌘V. Thoát Folio (⌘Q), mở lại: trang A và trang B đều nguyên vẹn, không mất hay lặp block nào, thứ tự và thụt lề đúng.
- [ ] Gõ chữ vào một trang rồi xoá trang đó ngay (nút "…" → Xoá → xác nhận) trước khi kịp thấy "đã lưu". Mong đợi: không có thông báo lỗi nào hiện lặp đi lặp lại, các trang còn lại vẫn mở và gõ được, app dùng bình thường.
- [ ] Dán khoảng 500 dòng văn bản (ví dụ `seq 1 500` trong Terminal rồi chép kết quả) vào một trang trống. Mong đợi: editor vẫn mượt (gõ thêm, cuộn không giật), chỉ báo lưu về "đã lưu"; thoát và mở lại vẫn còn đủ 500 dòng.
- [ ] Đăng xuất macOS (menu Apple → Đăng xuất) hoặc khởi động lại máy khi Folio đang mở và vừa gõ chữ. Ghi lại macOS hiện gì: ______ (hiện tại Folio sẽ khiến macOS hiện "đã chặn đăng xuất" — đã biết, sẽ sửa ở Giai đoạn 8). Sau đó đăng nhập lại, mở Folio: chữ vừa gõ vẫn còn.
