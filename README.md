# Ôn tập AI Thực chiến

Web tự học tiếng Việt, độc lập và **không phải** tài liệu hay đề thi chính thức của VinUni. Đọc bài theo bốn module rồi làm đề mô phỏng 90 phút; đáp án và phân tích chỉ hiện sau khi nộp. Đây là công cụ tự học, không dùng để chống gian lận: nội dung tĩnh có thể được xem qua công cụ phát triển trình duyệt.

## Chạy ở máy tính

Cần Node.js 22+. Trong thư mục dự án:

```bash
npm ci
npm test
npm run dev
```

Mở URL Vite hiển thị (thường là `http://localhost:5173`). Khi chưa xuất bản nội dung, trang hiện trạng thái chờ; đây là hành vi có chủ đích.

## Tạo và duyệt nội dung

OmniRoute chạy **ở máy tính của bạn**, không chạy trong trình duyệt hay trên GitHub Pages. Khai báo khóa API trong môi trường terminal của phiên hiện tại (không ghi vào code, Git, URL hoặc `VITE_*`):

```bash
read -rsp 'OmniRoute API key: ' OMNIROUTE_API_KEY; echo
export OMNIROUTE_API_KEY
npm run generate
unset OMNIROUTE_API_KEY
```

Nếu bạn đã lưu key trong `.env.local` ở thư mục dự án (file này được Git bỏ qua), `npm run generate` cũng tự đọc file đó; không cần `export` lại. Chỉ đặt `OMNIROUTE_API_KEY` trong file này, tuyệt đối không dùng tiền tố `VITE_`, không commit hoặc chia sẻ file. Có thể đổi model với `OMNIROUTE_MODEL` (mặc định `cx/gpt-6-sol`) hoặc endpoint với `OMNIROUTE_BASE_URL` (mặc định `http://localhost:20128/v1`). Lệnh tạo lưu `content/drafts/catalog.json` trên máy, kể cả khi không vượt kiểm tra cấu trúc để bạn có thể sửa; file này được Git bỏ qua.

1. Đọc toàn bộ bài học, 60 câu, đáp án, lời giải của cả A–D và kiểm tra tính đúng với nguồn. Validator chỉ bắt lỗi **cấu trúc**, không chứng minh đúng chuyên môn; URL nguồn chỉ là liên kết tham khảo, không phải trích dẫn xác thực từng mệnh đề.
2. Sau khi duyệt và sửa nếu cần, sao chép bản hoàn chỉnh vào `content/reviewed/catalog.json` (cũng được Git bỏ qua).
3. Kiểm tra lần cuối: `npm run validate -- content/reviewed/catalog.json`.
4. Chỉ khi thật sự chấp thuận xuất bản, chạy `npm run publish -- --approve-reviewed`. Lệnh này fetch `origin/main` và ghép bản đã duyệt với catalog đã đăng trên remote (không dùng catalog local có thể cũ/chưa duyệt), rồi ghi kết quả vào `public/content/catalog.json`; file chỉ **công khai** khi bạn commit/push.
5. Xem diff của file công khai, chạy `npm test && npm run build`, rồi mới commit/push. Không publish hoặc push bản chưa được con người duyệt.

Lệnh `generate` gọi tuần tự bốn module và không tự sửa nội dung AI sai định dạng; nếu model trả về JSON thiếu/truncated, cần chạy lại hoặc sửa nháp sau khi kiểm tra. Không đưa khóa vào GitHub Actions: CI chỉ build nội dung đã duyệt.

## Studio quản trị trên máy local

Chạy `npm run admin` rồi mở `http://127.0.0.1:4174/` trên **chính máy tính đang chạy lệnh**. Cần OmniRoute đang hoạt động và `OMNIROUTE_API_KEY` trong `.env.local` hoặc environment; không nhập key vào trang web. Studio chỉ nghe ở `127.0.0.1`, không được đưa lên GitHub Pages, và không thể truy cập từ điện thoại ở ngoài mạng. Trang học công khai vẫn xem được trên điện thoại dù máy tính tắt.

1. Bấm **Tạo bộ nội dung mới**; theo dõi bốn module hoàn tất lần lượt. Thời gian phụ thuộc model, không có phần trăm ước lượng. Nháp tạo xong được lưu local ở `content/drafts/catalog.json` (Git bỏ qua).
2. Mở từng bài học/câu hỏi để đọc đáp án và lời giải. Có thể sửa JSON trong trang, bấm **Lưu & kiểm tra**. Các lỗi cấu trúc chặn đăng, nhưng kiểm tra tự động **không chứng minh tính đúng đắn chuyên môn**.
3. Chỉ sau khi đã đọc và kiểm tra nguồn, tick xác nhận và bấm **Đăng bản đã duyệt**; hộp thoại hỏi lại trước khi commit/push đúng phiên bản nháp đã duyệt. Studio tự fetch `origin/main`, tạo Git worktree tạm cách ly, cài dependency từ lockfile, chạy test/build và chỉ commit/push catalog đã duyệt. File đang sửa, staging và file chưa theo dõi ở thư mục của bạn được giữ nguyên, không bị stash/reset/commit. Nếu nhánh web được cập nhật đồng thời, Studio dừng an toàn và cho đăng lại; không force-push. Sau push, Studio theo dõi GitHub Actions và đối chiếu dữ liệu trên Pages. Nếu báo lỗi, đọc trạng thái, xử lý rồi xác nhận lại; không tự ý đăng một bản khác.

> **Quan trọng:** Có file `public/content/catalog.json` chưa được bạn duyệt trong thư mục làm việc không có nghĩa là đã đăng. Đừng dùng `git add .` hoặc push file này nếu chưa kiểm tra. Quy trình CLI ở trên vẫn dùng được khi muốn duyệt và publish thủ công.

## Triển khai miễn phí

Workflow [deploy.yml](.github/workflows/deploy.yml) chạy test, build và đưa `dist` lên GitHub Pages sau mỗi push lên `main`. Tạo repository **public** có tên `on-tap`; bật Pages → Build and deployment → **GitHub Actions** trong Settings. Trước khi nội dung được duyệt, có thể deploy giao diện rỗng để kiểm tra; nội dung sẽ chỉ xuất hiện sau khi file `public/content/catalog.json` đã được duyệt, commit và push. URL dự kiến: `https://dzerok2020.github.io/on-tap/`. Site truy cập được từ điện thoại ở bất cứ đâu ngay cả khi máy tính tắt; tạo nội dung mới vẫn cần máy local và thao tác duyệt/push.

Nếu đổi tên repository, sửa `base` trong [vite.config.ts](vite.config.ts) cho khớp đường dẫn Pages. GitHub Pages free và chính sách tài khoản có thể thay đổi; kiểm tra bản deploy thực tế trước khi chia sẻ URL.

## Cấu trúc đề 60 câu

- A: 10 trắc nghiệm × 1 điểm = 10 điểm.
- B: 20 trắc nghiệm × 1,5 + 2 code tay × 2,5 = 35 điểm; Python/NumPy/Pandas.
- C: 18 trắc nghiệm × 1,5 + 2 tự luận × 4 = 35 điểm.
- D: 7 trắc nghiệm × 2 + 1 tự luận tình huống × 6 = 20 điểm.
- Tổng 100 điểm, 90 phút; ít nhất 42/60 câu có tình huống.
- Code/tự luận không được thực thi hay AI tự chấm: sau nộp, người học đối chiếu đáp án mẫu và rubric, đánh dấu đạt/chưa đạt. Điểm tự chấm được tách khỏi điểm trắc nghiệm; câu bỏ trống không được nhận điểm.
- Nháp cũ 20 câu không được xuất bản theo schema mới; hãy tạo bộ mới trong Studio. Không tự động chuyển 20 câu thành 60 bằng cách lặp câu.
- Publish dựa trên code đã có ở `origin/main`, không tự đưa code local chưa commit lên public. Thay đổi code chỉ được triển khai sau kiểm thử/review riêng.
