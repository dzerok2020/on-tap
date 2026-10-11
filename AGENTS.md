# AGENTS.md — Luật làm việc cho coding agent

## Phạm vi và quy trình

1. Mỗi lát thay đổi có một commit nhỏ và kiểm tra tương ứng; không commit code hỏng.
2. Chỉ sửa trong phạm vi yêu cầu; nếu thêm dependency mới, ghi lý do trong commit message hoặc tài liệu kỹ thuật.
3. Đọc `docs/product-plan.md` và `docs/tech-plan.md` trước khi viết tính năng. Nếu thiếu quyết định quan trọng về scope/kiến trúc, hỏi người dùng.
4. Không đưa API key, token hoặc nội dung bản nháp chưa duyệt lên Git hay site công khai.

## Kiểm chứng

- Báo cáo test, lint/build và thử chạy thực tế (pass/fail và phạm vi).
- Nêu lỗi thực thi nguyên văn khi chúng cản trở nghiệm thu.
- Trước mỗi lát lớn kiểm tra `git status`; sau lát chạy test và commit.

## An toàn và quyền xuất bản

- Khi lát hỏng, xem `git diff`, sửa hoặc quay lại checkpoint sạch; không dùng lệnh huỷ dữ liệu không kiểm tra.
- AI sinh nội dung vào draft local; con người duyệt trước khi xuất bản.
- Mọi nội dung thi là mô phỏng tự học, không tự nhận là đề chính thức VinUni.
- Con người là cổng cuối: kết quả AI và tính năng phải được kiểm tra thực tế trước khi tuyên bố hoàn tất.
