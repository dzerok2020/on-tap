# Product Plan — Ôn tập AI Thực chiến

## Mục tiêu và người dùng

Một người tự học bằng tiếng Việt chuẩn bị cho bài đánh giá năng lực mô phỏng ở mức SFIA L3/L4: đọc lý thuyết theo bốn module, luyện đề 90 phút, xem phân tích sau khi nộp. Đây không phải đề chính thức của VinUni.

## Phạm vi MVP

| Trong phạm vi | Ngoài phạm vi / v2 |
| --- | --- |
| Local CLI gọi OmniRoute để tạo bài học và đề mới, lưu bản nháp | Sinh đề trực tiếp từ điện thoại; sẽ cần backend trực tuyến và chi phí |
| Kiểm tra cấu trúc, tỷ lệ tình huống tối thiểu 70%, bốn module cân đối, A–D, giải thích từng lựa chọn | Tự động đánh giá tính đúng khoa học tuyệt đối; người phải rà soát |
| Xem nháp local và xuất bản bằng thao tác duyệt rõ ràng | Tự xuất bản nháp chưa được duyệt |
| Web tĩnh trên host miễn phí, điện thoại xem được ngay cả khi máy nhà tắt | Đăng nhập, đồng bộ tiến độ liên thiết bị, chống gian lận nghiêm ngặt |
| Đọc lý thuyết; làm bài hẹn giờ 90 phút; nộp rồi mới thấy đáp án và phân tích | Ngân hàng câu hỏi chính thức hoặc chứng nhận kết quả |

## Luồng trải nghiệm

1. Trên máy tính: chạy lệnh tạo nội dung, nhập API key qua biến môi trường cục bộ; xem báo cáo kiểm tra, mở bản nháp và sửa nếu cần.
2. Duyệt thủ công; lệnh publish sao chép nội dung đã duyệt vào thư mục công khai. Push lên repository kích hoạt deploy tĩnh.
3. Trên điện thoại hoặc máy tính: mở trang học, chọn module/bài, bắt đầu đề 90 phút; chọn A–D, chuyển câu, nộp hoặc tự nộp khi hết giờ; xem điểm và lời giải.
4. Nếu chưa có bài do AI tạo, trang thể hiện trạng thái chờ nội dung và hướng dẫn người quản trị tạo bài; không giả vờ có đề thật.

## Tiêu chí chấp nhận

- Mỗi đề 90 phút cân bằng 4 module, >=70% câu tình huống; bốn phương án và giải thích đúng + ba sai; validator chặn dữ liệu sai.
- Không tiết lộ đáp án trong giao diện trước khi nộp; sau nộp hiển thị điểm và giải thích. Đáp án trong bundle công khai có thể xem qua devtools: chỉ dùng tự học.
- API key không xuất hiện trong Git, bundle hay request của trình duyệt.
- Bản nháp không xuất hiện trên trang cho đến khi con người xác nhận lệnh xuất bản.
- Trang hiển thị hợp lý trên desktop và điện thoại; điều khiển bàn phím, focus rõ, reduced motion.
- Có hướng dẫn triển khai miễn phí; kiểm tra URL thật khi đã có quyền tạo repository và host.

## Rủi ro và câu hỏi mở

- Model `cx/gpt-6-sol` là lựa chọn ban đầu, chưa có benchmark chất lượng nội dung; giáo viên/người học phải kiểm tra nguồn và lập luận trước publish.
- Tài liệu GitHub nguồn tham khảo thay đổi theo thời gian; prompt yêu cầu dẫn URL gốc và tránh tuyên bố nội dung có bản quyền là nguyên văn.
- CI free host cần quyền GitHub Pages hoặc Cloudflare Pages; nếu chưa thiết lập quyền thì cung cấp script và bước còn thiếu, không tuyên bố đã deploy.
