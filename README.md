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

1. Đọc toàn bộ bài học, 20 câu, đáp án, lời giải của cả A–D và kiểm tra tính đúng với nguồn. Validator chỉ bắt lỗi **cấu trúc**, không chứng minh đúng chuyên môn; URL nguồn chỉ là liên kết tham khảo, không phải trích dẫn xác thực từng mệnh đề.
2. Sau khi duyệt và sửa nếu cần, sao chép bản hoàn chỉnh vào `content/reviewed/catalog.json` (cũng được Git bỏ qua).
3. Kiểm tra lần cuối: `npm run validate -- content/reviewed/catalog.json`.
4. Chỉ khi thật sự chấp thuận xuất bản, chạy `npm run publish -- --approve-reviewed`. Lệnh này chép bản đã duyệt vào `public/content/catalog.json`, là file **công khai** khi bạn commit/push.
5. Xem diff của file công khai, chạy `npm test && npm run build`, rồi mới commit/push. Không publish hoặc push bản chưa được con người duyệt.

Lệnh `generate` hiện gọi một lần và không tự sửa nội dung AI sai định dạng; nếu model trả về JSON thiếu/truncated, cần chạy lại hoặc sửa nháp sau khi kiểm tra. Không đưa khóa vào GitHub Actions: CI chỉ build nội dung đã duyệt.

## Triển khai miễn phí

Workflow [deploy.yml](.github/workflows/deploy.yml) chạy test, build và đưa `dist` lên GitHub Pages sau mỗi push lên `main`. Tạo repository **public** có tên `on-tap`; bật Pages → Build and deployment → **GitHub Actions** trong Settings. Trước khi nội dung được duyệt, có thể deploy giao diện rỗng để kiểm tra; nội dung sẽ chỉ xuất hiện sau khi file `public/content/catalog.json` đã được duyệt, commit và push. URL dự kiến: `https://dzerok2020.github.io/on-tap/`. Site truy cập được từ điện thoại ở bất cứ đâu ngay cả khi máy tính tắt; tạo nội dung mới vẫn cần máy local và thao tác duyệt/push.

Nếu đổi tên repository, sửa `base` trong [vite.config.ts](vite.config.ts) cho khớp đường dẫn Pages. GitHub Pages free và chính sách tài khoản có thể thay đổi; kiểm tra bản deploy thực tế trước khi chia sẻ URL.
