# Thư Mục Tài Liệu Báo Cáo Đồ Án Chuyên Ngành (`docs/report/`)

Thư mục này gom toàn bộ các tài sản phục vụ cuốn **Báo cáo Đồ án Chuyên ngành** vốn bị nằm rải rác trên các nhánh phụ (`docs`, `feature/sendMailRegister`) và `git stash`:

- [DACN_rewrite.docx](DACN_rewrite.docx) — Bản thảo Word cuốn báo cáo (khôi phục từ `stash@{0}`).
- [BAO_CAO_CHUONG_2.md](BAO_CAO_CHUONG_2.md) — Bản thảo Markdown Chương 2 (khôi phục từ nhánh `docs`).
- [BAO_CAO_CHUONG_3.md](BAO_CAO_CHUONG_3.md) — Bản thảo Markdown Chương 3 **đã được đồng bộ lại 8 Collections & Kiến trúc thực tế** (khôi phục từ nhánh `feature/sendMailRegister`).
- `scripts/` — 4 script Python (Pillow) sinh hình vẽ sơ đồ chuẩn cho báo cáo.
- `images/` — Các ảnh sơ đồ `.png` / `.svg` xuất ra từ bộ script.

---

## Các Điểm Cần Lưu Ý Khi Hoàn Thiện Cuốn Báo Cáo Word/PDF

Qua đối chiếu trực tiếp cuốn PDF 45 trang với mã nguồn chuẩn v2.7:

1. **Điền mục `Thiết kế cơ sở dữ liệu` (Trang 40–41 PDF đang để trống):**
   - Toàn bộ sơ đồ ERD và 8 bảng đặc tả chi tiết (`users`, `students`, `buildings`, `rooms`, `contracts`, `utility_readings`, `invoices`, `payments`) đã được chuẩn hóa 100% khớp code tại **Mục 3.5** của [BAO_CAO_CHUONG_3.md](BAO_CAO_CHUONG_3.md) và [DATA-SCHEMA.md](../DATA-SCHEMA.md). Có thể đưa thẳng vào Word.
2. **Sửa 2 chỗ dán nhầm hình trong bản PDF hiện tại:**
   - **Trang 19–21 (`1.6.3 Use Case phân rã phía Nhân viên (Staff)`):** Đang bị dán nhầm hình Use Case của *Sinh viên* (lặp lại 2 lần ở trang 20 và 21, thiếu hình của *Staff*).
   - **Trang 38 (`2.3.2 Biểu đồ trình tự Duyệt đơn đăng ký`):** Đang bị dán đúp cùng một ảnh 2 lần trên cùng một trang.
3. **Sửa lỗi đánh số đề mục Word (Heading Numbering):**
   - Từ Chương 2 → Chương 6 trong PDF, cấp đề mục con đang bị đánh lùi 1 số (`Chương 2` lại đánh `1.1..1.7`, `Chương 3` đánh `2.1..2.5`, `Chương 4` đánh `3.1..3.5`, `Chương 5` đánh `4.1..4.2`, `Chương 6` đánh `5.1..5.3`), trong khi Mục lục trang 2–3 hiển thị `2.x`, `3.x`, `4.x`, `5.x`, `6.x`.
4. **Chi tiết nhỏ trong bảng UC01 & UC02 (Trang 22 & 24 PDF):**
   - **UC01 Bước 3:** Bổ sung thêm 2 trường bắt buộc mới là `Số CCCD (12 số)` và `Địa chỉ thường trú`.
   - **UC02 Luồng thay thế `4a.2` (Từ chối đơn):** Đổi trạng thái cập nhật từ `terminated` sang `rejected` cho khớp với code thực tế.
