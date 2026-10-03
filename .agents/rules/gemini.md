---
trigger: always_on
---

# Bộ tài liệu dự án: HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ ĐH CÔNG NGHIỆP HÀ NỘI (DMS-KTX HaUI)

> **Stack:** React + Vite · Node.js + Express · MongoDB + Mongoose · Redis (Queue BullMQ + Cache-Aside) · Socket.io · Nodemailer · VietQR  
> **Kiến trúc:** Modular Monolith theo tính năng (Vertical Slice)  
> **Quy mô đội:** 5 người (3 backend · 2 frontend) · **Thời lượng:** 12 tuần  
> **Repo:** `FE_QuanLyKTX` (React + tài liệu này) · `BE_QuanLyKTX` (Node.js + Express)  
> **Phiên bản tài liệu:** v2.0 (Chuẩn hóa toàn diện nghiệp vụ HaUI 3 cơ sở & Smart KTX 4.0) · **Cập nhật:** 03/10/2026  

---

## 1. Bản đồ tài liệu

Bộ tài liệu chia làm **hai tầng**. Tầng 1 là hợp đồng kỹ thuật (tiếng Anh), tầng 2 là phân tích và kế hoạch (tiếng Việt).

### Tầng 1 — Hợp đồng kỹ thuật ⭐ *đọc trước khi code*

| Tài liệu | Trả lời câu hỏi | Ai cần |
|---|---|---|
| [PRD.md](PRD.md) | **Làm gì, không làm gì?** Phạm vi thực tế HaUI 3 cơ sở — ranh giới cứng | Cả nhóm |
| [ARCHITECTURE.md](ARCHITECTURE.md) | **Code để ở đâu?** Cấu trúc 14 module, hạ tầng Redis Queue/Cache, Socket.io, quy ước | Cả nhóm |
| [API.md](API.md) | **Gọi API thế nào?** 14 nhóm endpoint, envelope chuẩn, mã lỗi tiếng Anh | FE + BE |
| [DATA-SCHEMA.md](DATA-SCHEMA.md) | **Dữ liệu hình dạng ra sao?** 19 Collections, compound index, partial unique index | BE |

> ⚠️ **Bốn tài liệu này là chuẩn tối cao.** Khi một tài liệu tiếng Việt nói khác, lấy theo tầng 1.

### Tầng 2 — Phân tích, thiết kế, kế hoạch

| # | Tài liệu | Nội dung |
|---|----------|----------|
| 01 | [Tổng quan dự án](01-TONG-QUAN-DU-AN.md) | Bối cảnh 3 cơ sở HaUI, thực trạng, mục tiêu KPI, rủi ro — nguyên liệu Chương 1 báo cáo |
| 02 | [Đặc tả yêu cầu (SRS)](02-DAC-TA-YEU-CAU.md) | **10 phân hệ FR (M1-M10), NFR chịu tải cao, 4 tác nhân, 8 Use Case chi tiết** |
| 03 | [Phân tích nghiệp vụ](03-PHAN-TICH-NGHIEP-VU.md) | **76 quy tắc BR**, máy trạng thái, luồng nộp đơn Queue, cấp tài khoản email, ưu tiên giường dưới (BR-16), chia tiền điện nước |
| 07 | [Phân quyền & bảo mật](07-PHAN-QUYEN-BAO-MAT.md) | Ma trận RBAC 4 vai trò (`admin`, `manager`, `staff`, `student`), JWT 7 ngày, đổi mật khẩu lần đầu, chống IDOR |
| 08 | [Thiết kế giao diện](08-THIET-KE-GIAO-DIEN.md) | Sitemap, 38 màn hình (SCR-01 → SCR-38), Quét QR Check-in, Chat Socket.io, VietQR |
| 09 | [Kế hoạch & phân công](09-KE-HOACH-PHAN-CONG.md) | WBS, ngày công, phân vai RACI 3 BE / 2 FE |
| 10 | [Quy trình làm việc](10-QUY-TRINH-LAM-VIEC.md) | Git flow, quy ước commit/nhánh tiếng Anh, Definition of Done |
| 11 | [Kế hoạch kiểm thử](11-KE-HOACH-KIEM-THU.md) | Chiến lược test, test case tải cao, race condition giường, phân quyền |
| 12 | [Khung báo cáo đồ án](12-KHUNG-BAO-CAO.md) | **Khung đề cương 6 chương chuẩn Đồ án chuyên ngành KTPM HaUI (50–70 trang A4)** |
| 13 | [Lộ trình triển khai A→Z](13-LO-TRINH-TRIEN-KHAI.md) | Timeline 12 tuần, runbook cài đặt → deploy |
| 14 | [Hướng dẫn cho người mới](14-PHIEN-BAN-DON-GIAN-HOA.md) | Lộ trình tự học, mẫu code module hoàn chỉnh |
| 16 | [Yêu cầu API Backend](16-YEU-CAU-API-BACKEND.md) | Bảng đối chiếu 14 nhóm API cần bàn giao giữa FE và BE |

---

## 2. Đọc gì trước — theo vai trò

| Vai trò | Thứ tự đọc |
|---|---|
| **Thành viên mới (30 phút)** | `PRD.md` → `ARCHITECTURE.md` → [`14` mục 15 (mẫu code)](14-PHIEN-BAN-DON-GIAN-HOA.md) → `13` mục 3 (cài môi trường) |
| **Backend** | `DATA-SCHEMA.md` → `API.md` → `16-YEU-CAU-API-BACKEND.md` → `03` (quy tắc BR) → `07` |
| **Frontend** | `API.md` → `08-THIET-KE-GIAO-DIEN.md` → `07` (ma trận RBAC) |
| **Viết báo cáo** | `12-KHUNG-BAO-CAO.md` trước tiên, rồi lấy nội dung từ `01`, `02`, `03`, `DATA-SCHEMA.md`, `ARCHITECTURE.md` |
| **Quản lý tiến độ** | `09` → `13` |

---

## 3. Quy ước kỹ thuật cốt lõi

| Hạng mục | Quy ước | Chi tiết |
|---|---|---|
| Tác nhân (4 Roles) | `admin`, `manager`, `staff`, `student` | `07-PHAN-QUYEN-BAO-MAT.md` |
| Giá trị enum | **chữ thường** — `active`, `available`, `occupied`, `lower`, `upper` | `DATA-SCHEMA.md` |
| Envelope API | `{ code, message, data }` | `API.md` |
| Phân trang | `data: { items, total, page, limit }` | `API.md` |
| Base URL | `/api` | `API.md` |
| Chống trùng giường | `findOneAndUpdate` có điều kiện nguyên tử | `ARCHITECTURE.md` §5.3 |
| Tiền tệ | Số nguyên VND, không dùng số thực | `DATA-SCHEMA.md` |

---

## 4. Lịch sử phiên bản bộ tài liệu

| Phiên bản | Ngày | Nội dung |
|-----------|------|----------|
| v1.0 | 11/09/2026 | Khởi tạo 15 tài liệu ban đầu (PostgreSQL + Prisma) |
| v2.0 | 12/09/2026 | Hợp nhất sang MongoDB + Mongoose, Modular Monolith theo tính năng |
| **v2.0 (Chuẩn hóa HaUI)** | **03/10/2026** | **Chuẩn hóa toàn diện nghiệp vụ thực tế KTX ĐH Công nghiệp Hà Nội (3 cơ sở CS1, CS2, CS3):** 4 vai trò tác nhân (`admin`, `manager`, `staff`, `student`); CSDL 19 Collections; Hạ tầng chịu tải cao (Redis BullMQ Queue nộp đơn, Redis Cache phòng trống); Giao tiếp thời gian thực Socket.io; Cổng nộp đơn công khai, cấp tài khoản tự động qua Email; Ưu tiên giường tầng dưới theo thể chất (BR-16); Mã VietQR động Napas247; Quét mã QR Check-in; Đề cương báo cáo KTPM 50-70 trang A4 (`12-KHUNG-BAO-CAO.md`). |