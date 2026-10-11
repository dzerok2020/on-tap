# Tech Plan — Ôn tập AI Thực chiến

## Stack chốt

- Web: Vite + React + TypeScript — app tĩnh nhanh, hiển thị tốt trên điện thoại, không có backend giữ secret.
- Local CLI: Node.js 22+ dùng fetch chuẩn và dữ liệu JSON; gọi endpoint OpenAI-compatible OmniRoute qua biến `OMNIROUTE_API_KEY`, model mặc định `cx/gpt-6-sol`.
- Animation: GSAP + ScrollTrigger chỉ cho motion hỗ trợ định hướng, có `prefers-reduced-motion`.
- Host: GitHub Pages qua GitHub Actions, miễn phí cho repository public, deploy bundle sau mỗi push lên `main`. Không đưa khóa hay nháp lên host.

## Kiến trúc module

`CLI generate → content/drafts (private local) → validate → human review → CLI publish → public/content/catalog.json → Vite build → GitHub Pages`.

- `scripts/content.mjs`: generate, validate, publish, schema kiểm định; source URLs đi cùng nội dung.
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
src/
tests/
docs/product-plan.md
docs/tech-plan.md
```

## Chiến lược kiểm tra

- Unit Node test runner: kiểm tra cấu trúc bài học/câu hỏi, tỷ lệ tình huống, cân bằng module, duplicate ID, lý do A–D và yêu cầu file đã duyệt.
- Build TypeScript/Vite và chạy thử local. Thử đường đi học → chọn đáp án → nộp → kết quả; desktop + mobile screenshot nếu browser khả dụng.
- Trước public: quét secret, xem diff nội dung xuất bản; kiểm tra URL GitHub Pages sau Actions nếu có quyền và kết nối.

## Không quyết ở đây

Không áp schema DB, auth, server online, chọn model theo benchmark hay đồng bộ tiến độ. API key chỉ ở environment trong terminal, không có giá trị mặc định trong repo.
