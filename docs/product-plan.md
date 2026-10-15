# Product Plan — Ôn tập AI Thực chiến

## Mục tiêu và người dùng

Một người tự học bằng tiếng Việt chuẩn bị cho bài đánh giá năng lực mô phỏng ở mức SFIA L3/L4: đọc lý thuyết theo bốn module, luyện đề 90 phút, xem phân tích sau khi nộp. Đây không phải đề chính thức của VinUni.

## Phạm vi MVP

| Trong phạm vi | Ngoài phạm vi / v2 |
| --- | --- |
| Web quản trị chỉ chạy trên máy local gọi OmniRoute qua server local để tạo bài học và đề mới, lưu bản nháp; CLI vẫn dùng được | Sinh đề trực tiếp từ điện thoại; sẽ cần backend trực tuyến và chi phí |
| Kiểm tra cấu trúc, tỷ lệ tình huống tối thiểu 70%, phân bổ module 10/22/20/8, A–D, giải thích từng lựa chọn | Tự động đánh giá tính đúng khoa học tuyệt đối; người phải rà soát |
| Theo dõi tiến độ từng module, xem/chỉnh bản nháp local, kiểm tra và duyệt một phiên bản cụ thể rồi xác nhận đăng từ web local | Tự xuất bản nháp chưa được duyệt |
| Web tĩnh trên host miễn phí, điện thoại xem được ngay cả khi máy nhà tắt | Đăng nhập, đồng bộ tiến độ liên thiết bị, chống gian lận nghiêm ngặt |
| Đọc lý thuyết; làm bài hẹn giờ 90 phút; nộp rồi mới thấy đáp án và phân tích | Ngân hàng câu hỏi chính thức hoặc chứng nhận kết quả |

## Luồng trải nghiệm

1. Trên máy tính: mở web quản trị local, nhấn tạo nội dung; server giữ API key ở local và báo tiến độ theo các bước thực (bốn module, ghép và kiểm tra), lỗi từng bước không bị gọi là hoàn tất. CLI vẫn có thể dùng độc lập.
2. Xem, sửa nội dung dạng JSON có cấu trúc và kiểm tra lại; nút đăng yêu cầu xác nhận chính xác phiên bản nháp vừa xem. Server tự tạo checkout Git cách ly dựa trên origin/main, bảo toàn thay đổi local; chỉ commit file đã duyệt, push và theo dõi Actions. Push/deploy lỗi được hiển thị rõ để thử lại an toàn, không tự tuyên bố site đã cập nhật.
3. Trên điện thoại hoặc máy tính: mở trang học, chọn module/bài, bắt đầu đề 90 phút; chọn A–D hoặc nhập code/tự luận, chuyển câu, nộp hoặc tự nộp khi hết giờ; xem điểm và lời giải.
4. Nếu chưa có bài do AI tạo, trang thể hiện trạng thái chờ nội dung và hướng dẫn người quản trị tạo bài; không giả vờ có đề thật.

## Tiêu chí chấp nhận

- Mỗi đề 60 câu/100 điểm/90 phút theo phân bổ 10/22/20/8, >=70% câu tình huống; bốn phương án và giải thích đúng + ba sai; validator chặn dữ liệu sai.
- Không tiết lộ đáp án trong giao diện trước khi nộp; sau nộp hiển thị điểm và giải thích. Đáp án trong bundle công khai có thể xem qua devtools: chỉ dùng tự học.
- API key không xuất hiện trong Git, bundle hay request của trình duyệt.
- Bản nháp không xuất hiện trên trang cho đến khi con người xem, kiểm tra chuyên môn và xác nhận chính xác phiên bản sẽ đăng. Web local không được đưa vào GitHub Pages; trạng thái deploy chỉ báo thành công sau khi Actions và URL công khai xác nhận.
- Trang hiển thị hợp lý trên desktop và điện thoại; điều khiển bàn phím, focus rõ, reduced motion.
- Có hướng dẫn triển khai miễn phí; kiểm tra URL thật khi đã có quyền tạo repository và host.

## Rủi ro và câu hỏi mở

- Model `cx/gpt-6-sol` là lựa chọn ban đầu, chưa có benchmark chất lượng nội dung; giáo viên/người học phải kiểm tra nguồn và lập luận trước publish.
- Tài liệu GitHub nguồn tham khảo thay đổi theo thời gian; prompt yêu cầu dẫn URL gốc và tránh tuyên bố nội dung có bản quyền là nguyên văn.
- CI free host cần quyền GitHub Pages hoặc Cloudflare Pages; nếu chưa thiết lập quyền thì cung cấp script và bước còn thiếu, không tuyên bố đã deploy.

## Chấm điểm câu mở

55 trắc nghiệm tự chấm 81 điểm; 2 code và 3 tự luận tự đối chiếu rubric tối đa 19 điểm. Chỉ xem đáp án mẫu sau nộp; phân biệt điểm tự chấm và điểm tự động, câu trống luôn 0 điểm.
