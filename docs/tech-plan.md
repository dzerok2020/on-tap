# Tech Plan — Ôn tập AI Thực chiến

## Stack chốt

- Web: Vite + React + TypeScript — app tĩnh nhanh, hiển thị tốt trên điện thoại, không có backend giữ secret.
- Local CLI và web quản trị: Node.js 22+ dùng fetch chuẩn, HTTP server chỉ bind `127.0.0.1` và dữ liệu JSON; gọi OmniRoute bằng `OMNIROUTE_API_KEY` chỉ ở process local, model mặc định `cx/gpt-6-sol`.
- Animation: GSAP + ScrollTrigger chỉ cho motion hỗ trợ định hướng, có `prefers-reduced-motion`.
- Host: GitHub Pages qua GitHub Actions, miễn phí cho repository public, deploy bundle sau mỗi push lên `main`. Không đưa khóa hay nháp lên host.

## Kiến trúc module

`Web local → OmniRoute theo từng module → content/drafts (private local) → validate + human review + phiên bản nháp → xác nhận publish → public/content/catalog.json → commit/push chỉ file này → GitHub Actions → GitHub Pages`. CLI cũ vẫn là đường thủ công, cùng schema/validator; không có đường tự động bỏ qua duyệt.

- `scripts/content.mjs`: generate CLI, validate, publish CLI, schema kiểm định và source URLs.
- `scripts/admin.mjs`: server local một người dùng, tài nguyên quản trị riêng khỏi `public/` và Vite build; phát tiến độ qua polling, ghi nháp nguyên tử, chặn request khác origin/Host, chỉ gọi model ở server. Git chỉ commit file catalog sau khi xác nhận hash phiên bản, Git worktree tạm cách ly và theo dõi deploy.
- `scripts/publish.mjs`: tự fetch origin/main, checkout cách ly, kiểm thử, commit/push riêng catalog; không đụng index/worktree của người dùng, xử lý retry bằng nội dung giống hệt và chặn cập nhật đồng thời.
- `src/`: trang học, thi thử và kết quả; browser chỉ đọc nội dung đã publish, không gọi model.
- `public/content/`: bản đã duyệt; đánh dấu rõ mô phỏng, không che giấu bảo mật chống gian lận.
- `tests/`: validator và luồng publish; smoke test tương tác frontend nếu môi trường browser có sẵn.

## Cấu trúc thư mục dự kiến

```text
AGENTS.md
.github/workflows/deploy.yml
content/drafts/             # ignored
content/reviewed/           # ignored
public/content/catalog.json # only approved content
scripts/content.mjs
scripts/admin.mjs
admin/                    # chỉ phục vụ từ Node local, không nằm trong Vite build
src/
tests/
docs/product-plan.md
docs/tech-plan.md
```

## Chiến lược kiểm tra

- Unit Node test runner: kiểm tra cấu trúc bài học/câu hỏi, tỷ lệ tình huống, phân bổ 10/22/20/8, code/tự luận, 100 điểm, duplicate ID, lý do A–D và yêu cầu file đã duyệt.
- Build TypeScript/Vite và chạy thử local. Thử đường đi học → chọn đáp án → nộp → kết quả; desktop + mobile screenshot nếu browser khả dụng.
- Trước public: quét secret, xem diff nội dung xuất bản; kiểm tra URL GitHub Pages sau Actions nếu có quyền và kết nối.

## Không quyết ở đây

Không áp schema DB, auth, server online, chọn model theo benchmark hay đồng bộ tiến độ. API key chỉ ở environment trong terminal, không có giá trị mặc định trong repo.
