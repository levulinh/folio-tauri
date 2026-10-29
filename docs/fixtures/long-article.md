# Sổ tay xây dựng hệ thống ghi chú cá nhân

*Bài viết mẫu dài để kiểm tra định dạng: tiêu đề nhiều cấp, đoạn văn ngắn và dài, danh sách lồng nhau, việc cần làm, trích dẫn, khối mã, bảng, chữ đậm/nghiêng/gạch ngang, mã nội tuyến và liên kết. Nội dung là hư cấu nhưng được viết như một bài thật.*

## 1. Ghi chú không phải là kho lưu trữ

Hầu hết mọi người bắt đầu ghi chú vì sợ quên. Một ý tưởng lóe lên trong lúc đi bộ, một câu hỏi khách hàng vừa hỏi, một đoạn mã vừa sửa xong sau hai giờ vật lộn — tất cả đều được ném vào ứng dụng ghi chú nhanh nhất đang mở. Vài tháng sau, kho ghi chú đó trở thành một bãi rác có tổ chức: hàng trăm tệp, hàng nghìn dòng, và không ai dám xoá bất cứ thứ gì vì "biết đâu sau này cần".

Vấn đề không nằm ở số lượng. Vấn đề nằm ở chỗ ghi chú chỉ có giá trị khi nó được đọc lại, và hầu hết hệ thống ghi chú được tối ưu cho việc *viết vào* chứ không phải *lấy ra*. Người ta đo thành công bằng số ghi chú mới mỗi tuần, trong khi thước đo đúng nên là số lần một ghi chú cũ thực sự giúp giải quyết một việc đang làm.

Một hệ thống tốt không cần nhiều tính năng. Nó cần ba thứ: một nơi để bắt ý tưởng trong vòng vài giây, một nhịp đều đặn để biến nguyên liệu thô thành thứ có thể dùng, và một cách tìm lại đủ nhanh để không ai phải mở lại toàn bộ kho.

> Ghi chú không phải là bằng chứng của sự bận rộn. Ghi chú là công cụ để giảm số lần phải nghĩ lại từ đầu.

## 2. Ba nguyên tắc: bắt nhanh, xử lý chậm, tìm lại dễ

Ba nguyên tắc này nghe đơn giản nhưng lại loại bỏ phần lớn hệ thống ghi chú phức tạp trên thị trường. Chúng cũng đủ cụ thể để kiểm tra mỗi khi bạn muốn thêm một tính năng mới.

1. **Bắt nhanh.** Từ lúc có ý tưởng đến lúc nó nằm trong hệ thống phải dưới mười giây. Không chọn thư mục, không gắn thẻ, không đặt tiêu đề hoàn hảo. Nếu bước bắt mất hơn mười giây, bạn sẽ bỏ qua nó vào đúng lúc nó quý nhất.
2. **Xử lý chậm.** Nguyên liệu thô chỉ có giá trị sau khi được viết lại bằng lời của mình. Việc xử lý nên diễn ra theo lịch, không phải theo cảm hứng, và nên có giới hạn thời gian rõ ràng.
3. **Tìm lại dễ.** Một ghi chú không tìm thấy trong ba mươi giây gần như không tồn tại. Tìm kiếm toàn văn, tiêu đề có nghĩa và liên kết giữa các ghi chú quan trọng hơn mọi sơ đồ thư mục cầu kỳ.

Điều đáng chú ý là cả ba nguyên tắc đều *chống lại* việc trang trí. Một hệ thống đẹp nhưng chậm ở bước một sẽ thất bại. Một hệ thống nhanh nhưng không bao giờ được xử lý sẽ phình ra. Một hệ thống gọn gàng nhưng không tìm được sẽ khiến bạn viết lại những gì đã biết.

## 3. Kiến trúc tối giản

Hệ thống tối giản có ba tầng, và mỗi tầng chỉ làm một việc. Điều quan trọng là ranh giới giữa các tầng phải rõ: nguyên liệu thô không được trộn với ghi chú đã xử lý, và ghi chú đã xử lý không được trộn với dự án đang chạy.

### 3.1 Đầu vào

Đầu vào là nơi duy nhất được phép lộn xộn. Nó nhận mọi thứ: đoạn văn, ảnh chụp màn hình, liên kết, câu nói dở dang, một dòng mã, một câu hỏi chưa có câu trả lời. Đầu vào không cần tiêu đề hay cấu trúc. Nó chỉ cần nằm ở một chỗ và không bao giờ bị mất.

Một sai lầm phổ biến là biến đầu vào thành nơi lưu trữ lâu dài. Khi đó, mỗi ý tưởng nhỏ đều có vẻ quan trọng như nhau, và việc dọn dẹp trở nên đáng sợ. Đầu vào nên có hạn mức: nếu nó vượt quá một tuần mà chưa được xử lý, hoặc là xử lý, hoặc là xoá.

### 3.2 Xử lý

Xử lý là bước biến nguyên liệu thành kiến thức. Ở đây bạn viết lại ý tưởng bằng lời của mình, thêm bối cảnh, nối nó với những gì đã biết, và quyết định nó thuộc về đâu. Một ghi chú đã xử lý phải trả lời được ba câu hỏi: nó nói về cái gì, nó liên quan đến việc gì, và khi nào tôi sẽ cần nó.

Bước này là bước duy nhất không thể tự động hoá hoàn toàn. Công cụ có thể nhắc bạn, gom nguyên liệu, gợi ý liên kết, nhưng không thể thay bạn hiểu. Một ghi chú được sao chép nguyên văn từ nguồn khác không phải là kiến thức của bạn; nó chỉ là một bản sao có thể mất đi cùng nguồn gốc.

### 3.3 Đầu ra

Đầu ra là nơi ghi chú quay lại công việc: một bài viết, một quyết định, một câu trả lời cho khách hàng, một đoạn mã, một buổi chia sẻ. Nếu một ghi chú không bao giờ đi đến đầu ra, nó chỉ là vật trang trí. Đầu ra không cần lớn; một câu trả lời rõ ràng cho đồng nghiệp cũng là đầu ra.

Cấu trúc thư mục có thể rất đơn giản:

```text
ghi-chu/
  dau-vao/          # nguyên liệu thô, xoá sau khi xử lý
  ghi-chu/          # ghi chú đã xử lý, đặt tên theo ý tưởng
  du-an/            # ghi chú gắn với một dự án đang chạy
  dau-ra/           # bài viết, quyết định, tài liệu chia sẻ
```

| Tầng | Câu hỏi nó trả lời | Thời gian sống | Được phép lộn xộn |
| --- | --- | --- | --- |
| Đầu vào | Tôi vừa thấy gì? | Vài ngày | Có |
| Ghi chú | Điều này có nghĩa gì? | Nhiều tháng | Không |
| Dự án | Việc này đang ở đâu? | Đến khi xong | Một phần |
| Đầu ra | Tôi sẽ nói gì với người khác? | Lâu dài | Không |

## 4. Nhịp làm việc hằng ngày

Hệ thống chỉ sống nếu nó có nhịp. Nhịp không cần dày; nó cần đều. Ba mươi phút mỗi ngày hiệu quả hơn bốn giờ mỗi chủ nhật, vì bốn giờ đó thường bị dùng để dọn dẹp những thứ lẽ ra phải xử lý từ đầu tuần.

Một ngày làm việc với ghi chú có thể chia thành bốn chặng:

- **Buổi sáng, mười phút.** Mở đầu vào, đọc lướt, chọn ra ba thứ đáng xử lý hôm nay. Không cố xử lý tất cả.
- **Trước khi bắt đầu việc sâu, năm phút.** Viết ra kết quả mong muốn của phiên làm việc bằng một câu. Câu này sẽ được dán vào ghi chú của dự án.
- **Sau mỗi phiên, năm phút.** Ghi lại điều vừa học, điều còn vướng, và bước tiếp theo. Đây là nguyên liệu tốt nhất cho ghi chú dài hạn.
- **Cuối ngày, mười phút.** Xoá những gì không còn cần, nối những gì liên quan, và để lại một ghi chú cho chính mình vào sáng mai.

| Khung giờ | Hoạt động | Đầu ra |
| --- | --- | --- |
| 08:30 – 08:40 | Lọc đầu vào | Ba việc đáng xử lý |
| 08:40 – 08:45 | Viết mục tiêu phiên | Một câu kết quả |
| 09:00 – 11:30 | Làm việc sâu | Sản phẩm dở dang |
| 11:30 – 11:40 | Ghi lại bài học | Ghi chú ngắn |
| 17:30 – 17:40 | Dọn cuối ngày | Đầu vào sạch |

Danh sách việc cần làm cho một ngày điển hình:

- [x] Đọc lại ba ghi chú từ hôm qua
- [x] Viết mục tiêu cho phiên làm việc sâu
- [ ] Xử lý hai nguyên liệu trong đầu vào
- [ ] Nối ghi chú mới với ít nhất một ghi chú cũ
- [ ] Xoá ba thứ không còn giá trị
- [ ] Chuẩn bị một câu hỏi cho ngày mai

Danh sách lồng nhau cho việc dọn đầu vào:

- Nhóm theo chủ đề
  - Giữ lại nếu liên quan đến dự án đang chạy
  - Giữ lại nếu trả lời một câu hỏi thường gặp
  - Xoá nếu chỉ là tin tức sẽ cũ trong một tuần
- Đặt lại tên
  - Tên phải là một ý tưởng, không phải một ngày
  - Tên phải đủ cụ thể để tìm lại
- Thêm một liên kết
  - Liên kết đến ghi chú liên quan
  - Liên kết đến nguồn gốc nếu cần kiểm chứng

## 5. Viết để tìm lại

Tìm lại là kỹ năng bị đánh giá thấp nhất trong mọi hệ thống ghi chú. Người ta dành hàng giờ để chọn ứng dụng, thiết kế thư mục, và rất ít thời gian để viết những câu mà sau này chính mình có thể tìm thấy. Một tiêu đề tốt tiết kiệm nhiều thời gian hơn một hệ thống thư mục hoàn hảo.

Ba quy tắc đặt tiêu đề:

1. Viết tiêu đề như một câu khẳng định, không phải một nhãn. "Ghi chú họp" không tìm được; "Quyết định hoãn ra mắt sang tháng sau" thì tìm được.
2. Đưa từ khoá quan trọng lên đầu. Bạn sẽ nhớ từ khoá, không nhớ ngày tạo.
3. Tránh tiêu đề trùng nhau. Nếu hai ghi chú cùng tên, ít nhất một trong hai nên được sáp nhập.

Với tìm kiếm toàn văn, chất lượng văn bản quan trọng hơn cấu trúc. Một ghi chú có tiêu đề rõ, câu đầu tiên tóm tắt, và các từ khoá tự nhiên sẽ được tìm thấy ngay cả khi bạn quên nó nằm ở đâu. Một ghi chú chỉ có ảnh chụp màn hình thì gần như vô hình.

Ví dụ một truy vấn tìm kiếm đơn giản trên cơ sở dữ liệu ghi chú:

```sql
SELECT page_id, title, snippet(pages_fts, 1, '[', ']', '…', 12) AS doan
FROM pages_fts
WHERE pages_fts MATCH 'ghi chú OR "tìm lại"'
ORDER BY rank
LIMIT 20;
```

| Cách tìm | Phù hợp khi | Điểm yếu |
| --- | --- | --- |
| Tìm toàn văn | Bạn nhớ một từ hoặc cụm từ | Không tìm được ý tưởng chưa viết ra |
| Tiêu đề có nghĩa | Bạn nhớ chủ đề | Phụ thuộc vào kỷ luật đặt tên |
| Liên kết giữa ghi chú | Bạn đang ở gần đúng chỗ | Cần thời gian duy trì |
| Thẻ hoặc thuộc tính | Bạn cần lọc theo trạng thái | Dễ sinh ra quá nhiều thẻ |
| Ngày tạo | Bạn nhớ bối cảnh thời gian | Hiếm khi đủ chính xác |

## 6. Chọn công cụ

Không có công cụ nào phù hợp với mọi người, nhưng có một tiêu chí ít ai dùng: công cụ phải *giảm* số quyết định, không phải tăng. Mỗi lựa chọn mới — thư mục nào, thẻ nào, màu nào, mẫu nào — là một lý do để trì hoãn việc viết. Công cụ tốt khiến việc viết trở thành lựa chọn mặc định.

Một số câu hỏi nên trả lời trước khi chọn:

- Dữ liệu nằm ở đâu, và tôi có thể lấy ra khi công cụ biến mất không?
- Tìm kiếm có hoạt động tốt với ngôn ngữ của tôi, kể cả khi gõ không dấu?
- Tôi có thể viết mà không cần chạm chuột không?
- Ứng dụng có mở nhanh như một tờ giấy không?
- Chi phí thật là gì, tính cả thời gian di chuyển dữ liệu?

Ba loại công cụ thường gặp:

- **Ứng dụng ghi chú dạng khối.** Mạnh về cấu trúc, bảng, mã, ảnh. Phù hợp với ghi chú kỹ thuật và tài liệu dài. Rủi ro là khoá dữ liệu nếu không có xuất Markdown.
- **Tệp văn bản thuần.** Bền, dễ sao lưu, dễ tìm bằng công cụ hệ điều hành. Yếu về bảng phức tạp, ảnh và liên kết hai chiều.
- **Ứng dụng ghi chú nhanh.** Tốt cho đầu vào, yếu cho đầu ra. Chỉ nên dùng như tầng đầu tiên, không phải toàn bộ hệ thống.

Một liên kết hữu ích để đọc thêm: [BlockNote](https://www.blocknotejs.org/), [Tauri](https://tauri.app/), và [Markdown Guide](https://www.markdownguide.org/). Nếu bạn làm việc với dữ liệu lớn, hãy đọc cả tài liệu về SQLite FTS5 tại [SQLite FTS5](https://www.sqlite.org/fts5.html).

## 7. Tự động hoá nhỏ

Tự động hoá chỉ đáng làm khi nó loại bỏ một việc lặp lại *và* không tạo ra một việc mới phức tạp hơn. Một script mười dòng chạy mỗi sáng có thể tiết kiệm vài phút; một hệ thống plugin mười tệp cấu hình thì thường không.

Ví dụ một script sao lưu đơn giản:

```bash
#!/usr/bin/env bash
set -euo pipefail

nguon="$HOME/Library/Application Support/io.folio.app"
dich="$HOME/Backups/folio"
ngay="$(date +%Y-%m-%d)"

mkdir -p "$dich"
sqlite3 "$nguon/folio.sqlite" ".backup '$dich/folio-$ngay.sqlite'"
find "$dich" -name 'folio-*.sqlite' -mtime +30 -delete

echo "Đã sao lưu vào $dich/folio-$ngay.sqlite"
```

Một hàm TypeScript nhỏ để chuẩn hoá tiêu đề trước khi lưu:

```ts
export function tieuDeSach(raw: string): string {
  const motDong = raw.replace(/\s+/g, " ").trim();
  if (motDong === "") return "Không có tiêu đề";
  return motDong.length > 120 ? `${motDong.slice(0, 117)}…` : motDong;
}
```

Các bước để thêm một tự động hoá mới:

1. Ghi lại việc đang làm bằng tay, kèm thời gian thực tế.
2. Chỉ tự động hoá nếu việc đó lặp lại ít nhất ba lần mỗi tuần.
3. Viết phiên bản đơn giản nhất có thể chạy được.
4. Chạy song song với cách làm tay trong một tuần.
5. Chỉ xoá cách làm tay khi tự động hoá đã chứng minh ổn định.

> Nếu một tự động hoá cần bạn trông nó, nó không phải tự động hoá. Nó là một công việc mới.

## 8. Định dạng: dùng gì và khi nào

Định dạng không phải là trang trí. Nó là tín hiệu cho người đọc biết cái gì quan trọng, cái gì là ví dụ, cái gì là lời cảnh báo, và cái gì có thể bỏ qua. Lạm dụng định dạng khiến mọi thứ trông quan trọng như nhau, và khi mọi thứ quan trọng thì không có gì quan trọng.

### 8.1 Tiêu đề

Tiêu đề cấp một chỉ nên có một, và nó nên là tên của ghi chú. Tiêu đề cấp hai chia ghi chú thành các phần độc lập. Tiêu đề cấp ba chỉ dùng khi một phần thật sự có nhiều nhánh. Nếu bạn cần tiêu đề cấp bốn, có lẽ ghi chú nên được tách thành hai.

### 8.2 Danh sách

Danh sách có thứ tự dùng cho các bước phải làm lần lượt. Danh sách không thứ tự dùng cho các ý ngang hàng. Danh sách việc cần làm dùng khi có trạng thái hoàn thành rõ ràng. Đừng dùng danh sách cho những đoạn văn chỉ có một ý.

- Dùng gạch đầu dòng cho ý ngang hàng.
- Dùng số thứ tự cho quy trình.
- Dùng việc cần làm cho trạng thái.
- Dùng đoạn văn cho lập luận.

### 8.3 Trích dẫn

Trích dẫn dùng để tách một câu quan trọng khỏi mạch văn, hoặc để ghi lại nguyên văn một nguồn. Không nên dùng trích dẫn cho toàn bộ ghi chú, vì khi đó nó mất tác dụng nhấn mạnh.

> Một câu trích dẫn hay không cần giải thích. Nó chỉ cần đúng chỗ.

### 8.4 Khối mã

Khối mã dùng cho mã chạy được, cấu hình, hoặc văn bản cần giữ nguyên khoảng trắng. Đừng dùng khối mã cho những đoạn văn chỉ vì chúng trông "kỹ thuật". Trong bài này, các khối mã đều là ví dụ thật hoặc gần thật.

### 8.5 Bảng

Bảng dùng khi có từ ba cột trở lên và các hàng thật sự so sánh được với nhau. Bảng hai cột thường nên là danh sách định nghĩa. Bảng quá rộng sẽ khó đọc trên cửa sổ hẹp; hãy giữ số cột ở mức tối thiểu.

### 8.6 Định dạng nội tuyến

Trong một câu, bạn có thể dùng **chữ đậm** để nhấn mạnh, *chữ nghiêng* để đánh dấu thuật ngữ, ~~chữ gạch ngang~~ để cho thấy điều đã bị thay thế, và `mã nội tuyến` cho tên hàm, biến hoặc lệnh. Đừng dùng chữ đậm cho cả câu; nếu cả câu quan trọng, hãy tách nó thành đoạn riêng.

Ví dụ: hàm `tieuDeSach` chuẩn hoá khoảng trắng trước khi lưu, còn hằng số `MAX_TITLE_LENGTH` quy định giới hạn 120 ký tự. Nếu bạn đổi giới hạn, hãy cập nhật cả hàm và kiểm thử.

## 9. Những lỗi thường gặp

1. **Lưu mọi thứ.** Kho phình ra, tìm kiếm nhiễu, và bạn mất niềm tin vào hệ thống. Hãy xoá nhiều hơn.
2. **Không bao giờ xử lý đầu vào.** Đầu vào trở thành một nghĩa trang của những ý tưởng chưa từng được nghĩ tiếp.
3. **Đặt tiêu đề chung chung.** "Ghi chú", "Ý tưởng", "Họp" — những tiêu đề này không giúp tìm lại.
4. **Dùng thẻ thay cho câu.** Một thẻ "quan-trọng" không cho biết vì sao nó quan trọng.
5. **Sao chép nguyên văn.** Bạn có một bản sao, không có kiến thức.
6. **Trang trí quá mức.** Quá nhiều màu, biểu tượng và khung khiến nội dung khó đọc.
7. **Không có đầu ra.** Ghi chú không bao giờ được dùng sẽ mất giá trị theo thời gian.
8. **Đổi công cụ quá thường xuyên.** Mỗi lần chuyển, bạn mất một phần ngữ cảnh và một phần thói quen.

> Sai lầm lớn nhất không phải là ghi chú kém. Sai lầm lớn nhất là xây một hệ thống mà bạn không muốn mở mỗi ngày.

Một lỗi nữa ít được nhắc: **để ghi chú cũ mà không bao giờ đọc lại**. Một ghi chú được viết ba năm trước có thể vẫn đúng, nhưng nếu bạn không bao giờ xem nó, nó chỉ là dữ liệu. Hãy đặt lịch đọc lại theo chủ đề, không phải theo ngày tạo.

## 10. Checklist hằng tuần

- [ ] Dọn sạch đầu vào, chỉ giữ lại những gì sẽ xử lý trong tuần
- [ ] Xử lý ít nhất năm nguyên liệu thành ghi chú có tiêu đề rõ
- [ ] Nối mỗi ghi chú mới với ít nhất một ghi chú cũ
- [ ] Xoá những ghi chú đã lỗi thời hoặc trùng lặp
- [ ] Viết một đoạn đầu ra: câu trả lời, quyết định, hoặc bài viết ngắn
- [ ] Sao lưu dữ liệu và kiểm tra bản sao lưu mở được
- [ ] Đọc lại một ghi chú cũ và cập nhật nếu cần

## 11. Câu hỏi thường gặp

### 11.1 Tôi nên có bao nhiêu ghi chú?

Không có con số đúng. Một người có hai trăm ghi chú được xử lý kỹ sẽ hữu ích hơn một người có hai mươi nghìn ghi chú chưa từng đọc lại. Hãy đo bằng số lần bạn tìm thấy thứ mình cần, không phải bằng số ghi chú.

### 11.2 Tôi có nên dùng thẻ không?

Có, nhưng ít. Thẻ hữu ích khi chúng đại diện cho một trạng thái hoặc một loại công việc ổn định. Thẻ vô dụng khi chúng mô tả nội dung, vì nội dung đã nằm trong văn bản và có thể tìm bằng tìm kiếm toàn văn.

### 11.3 Tôi có nên viết bằng ngôn ngữ thứ hai không?

Viết bằng ngôn ngữ bạn nghĩ nhanh nhất. Nếu bạn cần chia sẻ với người khác, hãy dịch ở bước đầu ra, không phải ở bước ghi chú. Việc dịch quá sớm làm chậm quá trình và dễ mất sắc thái.

### 11.4 Làm sao để bắt đầu lại khi hệ thống đã rối?

Đừng cố dọn tất cả. Chọn một chủ đề đang làm, tạo một ghi chú mới, và chỉ chuyển những gì thật sự cần cho chủ đề đó. Phần còn lại có thể để nguyên như một kho lưu trữ, miễn là bạn không thêm vào đó nữa.

### 11.5 Ghi chú có cần đẹp không?

Đủ đẹp để bạn muốn mở, nhưng không đẹp đến mức bạn sợ viết vào. Định dạng nên giúp đọc nhanh, không phải để trưng bày. Một tiêu đề rõ và vài đoạn văn ngắn thường đủ.

## 12. Phụ lục A: mẫu ghi chú cuộc họp

```text
Cuộc họp: Ra mắt bản 0.4
Ngày: 2026-10-29
Người tham gia: A, B, C

Mục tiêu
- Chốt phạm vi bản 0.4
- Xác định người chịu trách nhiệm cho từng hạng mục

Quyết định
- Hoãn tính năng đồng bộ sang bản 0.5
- Giữ nguyên mô hình dữ liệu hiện tại
- Ra mắt trên macOS trước, Windows sau

Việc cần làm
- [ ] A: viết tài liệu di chuyển dữ liệu
- [ ] B: kiểm tra hiệu năng với 10.000 khối
- [ ] C: chuẩn bị bản nháp thông cáo

Câu hỏi mở
- Có cần hỗ trợ nhập từ Markdown ngay trong bản 0.4 không?
- Ai sẽ trả lời phản hồi của người dùng trong tuần ra mắt?
```

## 13. Phụ lục B: bảng thuật ngữ

| Thuật ngữ | Nghĩa trong bài | Ghi chú |
| --- | --- | --- |
| Đầu vào | Nơi nhận nguyên liệu thô | Được phép lộn xộn |
| Xử lý | Viết lại nguyên liệu thành kiến thức | Không tự động hoá hoàn toàn |
| Đầu ra | Sản phẩm dùng được: bài viết, quyết định, câu trả lời | Là thước đo giá trị |
| Ghi chú dài hạn | Ghi chú đã xử lý, có tiêu đề rõ | Nên liên kết với ghi chú khác |
| Nguyên liệu | Ý tưởng, liên kết, ảnh, câu hỏi chưa xử lý | Có hạn mức thời gian |
| Tìm lại | Khả năng tìm thấy trong ba mươi giây | Quan trọng hơn cấu trúc thư mục |
| Đầu ra tối thiểu | Một câu trả lời rõ ràng cho đồng nghiệp | Không cần lớn |

## 14. Phụ lục C: kiểm tra đoạn văn dài

Đoạn văn sau được viết dài có chủ đích để kiểm tra cách trình soạn thảo xuống dòng, giữ nhịp đọc và cuộn trang khi nội dung vượt quá một màn hình. Trong một hệ thống ghi chú, độ dài không phải là tiêu chí duy nhất của chất lượng, nhưng khả năng đọc một đoạn dài mà không mất dấu là một kỹ năng quan trọng, đặc biệt khi bạn đang cố hiểu một lập luận phức tạp hoặc một quyết định có nhiều bối cảnh. Một đoạn văn dài không nên bị chia nhỏ chỉ để trông gọn hơn nếu các câu vẫn liên kết với nhau bằng một mạch lập luận rõ ràng; ngược lại, một đoạn văn dài có thể che giấu nhiều ý tưởng khác nhau và khiến người đọc khó tìm ra điểm chính. Cách tốt nhất là đọc lại và tự hỏi mỗi đoạn đang trả lời câu hỏi nào, liệu câu đầu tiên có nêu được ý chính không, và liệu câu cuối có mở ra bước tiếp theo không. Nếu câu trả lời là có, đoạn văn có thể giữ nguyên; nếu không, hãy tách hoặc viết lại. Việc này nghe có vẻ hiển nhiên nhưng lại là bước bị bỏ qua nhiều nhất khi người ta vội vàng ghi chú, và chính sự vội vàng đó tạo ra những tài liệu dài nhưng không ai muốn đọc lại.

Một ví dụ về chuỗi ký tự dài không có khoảng trắng để kiểm tra tràn dòng: `https://example.com/mot-duong-dan-rat-dai/voi-nhieu-doan/va-tham-so?utm_source=ghi-chu&utm_medium=noi-bo&utm_campaign=kiem-tra-dinh-dang&session=abcdefghijklmnopqrstuvwxyz0123456789`

Và một mã định danh dài: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

Một đoạn văn ngắn xen giữa để kiểm tra khoảng cách giữa các khối. Sau đó là một đoạn văn khác, cũng ngắn, để kiểm tra nhịp điệu khi có nhiều khối liên tiếp. Việc phân biệt khoảng cách giữa các đoạn với khoảng cách giữa các phần là một chi tiết nhỏ nhưng ảnh hưởng lớn đến cảm giác đọc.

## 15. Kết

Một hệ thống ghi chú tốt không bắt đầu bằng một ứng dụng. Nó bắt đầu bằng một quyết định: chỉ giữ lại những gì sẽ được dùng, và xử lý đủ nhanh để kho không trở thành nơi chôn ý tưởng. Công cụ chỉ là phương tiện; nhịp làm việc mới là thứ giữ cho hệ thống sống.

Nếu bạn chỉ làm được một việc sau khi đọc bài này, hãy chọn một chủ đề đang làm và viết một ghi chú có tiêu đề rõ ràng, một câu tóm tắt, và một liên kết đến ghi chú cũ. Đó là hạt giống của một hệ thống tốt hơn.

> Bắt đầu nhỏ, xử lý đều, và để cho việc tìm lại trở thành thói quen.
