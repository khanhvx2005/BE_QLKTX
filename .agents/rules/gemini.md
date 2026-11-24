# Quy Ước Dự Án: HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ ĐH CÔNG NGHIỆP HÀ NỘI (HaUI - DMS v3.0)

> **Stack:** React + Vite + Ant Design · Node.js + Express 5 · MongoDB + Mongoose 9 · JWT · Bcryptjs · Nodemailer · VietQR Webhook (NAPAS 247)  
> **Kiến trúc:** Modular Monolith (`Routes -> Services -> Models + Shared Views`), không Redis/BullMQ, không Socket.io  
> **Quy mô dữ liệu:** **10 Modules · 11 Collections · 4 Vai trò RBAC (`admin`, `manager`, `staff`, `student`) + Guest**  
> **Địa giới 3 Cơ sở HaUI 2026:** `cs1` (298 Cầu Diễn, Tây Tựu, HN: A14–A15) · `cs2` (TDP Thượng 2, Tây Tựu, HN: B12–B14) · `cs3` (Phù Vân, Ninh Bình: C15–C17)

---

## 1. Bản Đồ Tài Liệu Chuẩn (Single Source of Truth)

| Tài liệu | Nội dung cốt lõi |
|---|---|
| [PRD.md](docs/PRD.md) | Bối cảnh 3 cơ sở HaUI 2026–2027, bảng giá phòng chính thức, mục tiêu số hóa |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc Modular Monolith 10 phân hệ & quy tắc kỹ thuật cốt lõi |
| [EDIT_DOCS_DATA_SCHEMA.md](docs/EDIT_DOCS_DATA_SCHEMA.md) | ERD & đặc tả chi tiết **11 Collections** + Khóa slot phòng nguyên tử (`$expr` + `$inc`) |
| [EDIT_DOCS_DAC_TA_YEU_CAU.md](docs/EDIT_DOCS_DAC_TA_YEU_CAU.md) | Đặc tả SRS v3.0: 4 vai trò RBAC, Đợt đăng ký, phân luồng MSSV, Webhook VietQR, QR Check-in, Yêu cầu & Thông báo |
| [API.md](docs/API.md) | Hợp đồng RESTful API v3.0 đầy đủ (10 nhóm endpoint cho FE ↔ BE) |

---

## 2. Quy Ước Kỹ Thuật Bất Biến

- **Phân quyền 4 vai trò (`ROLES`):** `'admin'` (chỉ quản trị hệ thống & user — KHÔNG duyệt đơn hay xem doanh thu), `'manager'` (mở đợt, cấu hình tòa/phòng, duyệt chuyển phòng, **xem Báo cáo Doanh thu**), `'staff'` (vận hành hàng ngày), `'student'`.
- **Phân luồng Tân SV vs Năm 2+:** Bóc tự động từ 4 chữ số đầu MSSV 10 chữ số (`YYYY60xxxx`) so với `RegistrationPeriod.academicYearStart`.
- **Vòng đời Hợp đồng chống bỏ cọc:** `pending` → `pending_payment` (hạn 7 ngày, quá hạn hủy `cancelled` nhả chỗ ngay) → `active` (tự động nâng khi gạch nợ đủ tiền phòng & cọc, sinh mã **QR Check-in**) → `terminated` (hoàn cọc có khấu trừ hỏng đồ).
- **Quản lý sức chứa đến cấp Phòng (không lưu vị trí giường):** Khóa/nhả chỗ nguyên tử bằng `Room.findOneAndUpdate({ _id, status: 'active', $expr: { $lt: ['$occupiedCount', '$capacity'] } }, { $inc: { occupiedCount: 1 } })`.
- **Envelope & Chuẩn dữ liệu:** `{ code, message, data }`, phân trang `{ items, total, page, limit }`, ngày nghiệp vụ `'YYYY-MM-DD'` theo `UTC+7`, tiền tệ số nguyên VNĐ.
