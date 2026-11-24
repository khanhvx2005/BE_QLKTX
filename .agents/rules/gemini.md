# Quy Ước Dự Án: HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ ĐH CÔNG NGHIỆP HÀ NỘI (HaUI - DMS)

> **Stack:** React + Vite + Ant Design · Node.js + Express 5 · MongoDB + Mongoose 9 · JWT · Bcryptjs · Nodemailer · VietQR (NAPAS 247)  
> **Kiến trúc:** Client–Server tách rời · Backend Modular Monolith theo phân hệ nghiệp vụ (`Routes -> Services -> Models + Shared Views`)  
> **Quy mô dữ liệu:** **8 Modules · 8 Collections cốt lõi · 3 Vai trò RBAC (`admin`, `staff`, `student`) + Guest**  
> **Kho mã nguồn:** `BE_QLKTX` (Node.js + Express) · `FE_QuanLyKTX` (React + Vite)  
> **Phiên bản chuẩn hóa:** v2.7 (Đồng bộ thực tế triển khai & Báo cáo Đồ án Chuyên ngành)

---

## 1. Bản Đồ Tài Liệu Chuẩn (Single Source of Truth)

Mọi thay đổi mã nguồn hoặc đối chiếu Frontend ↔ Backend **bắt buộc lấy theo 5 tài liệu chuẩn tại `docs/`**:

| Tài liệu | Nội dung cốt lõi |
|---|---|
| [PRD.md](docs/PRD.md) | Bài toán thực tế KTX HaUI, mục tiêu, 4 tác nhân, phạm vi 8 phân hệ và ranh giới ngoài hệ thống |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc Modular Monolith (`routes -> services -> models`), quy tắc khóa nguyên tử `$elemMatch`, bù trừ lỗi, ngày tháng `UTC+7` |
| [DATA-SCHEMA.md](docs/DATA-SCHEMA.md) | ERD & đặc tả chi tiết **8 Collections** (`users`, `students`, `buildings`, `rooms`, `contracts`, `utility_readings`, `invoices`, `payments`) |
| [API.md](docs/API.md) | Hợp đồng RESTful API v2.7 đầy đủ (10 nhóm endpoint, query, body, cấu trúc trả về, mã lỗi) |
| [DAC-TA-YEU-CAU.md](docs/DAC-TA-YEU-CAU.md) | Đặc tả yêu cầu phần mềm (SRS): Use Case, 28+ FR, NFR, 8 quy tắc nghiệp vụ (`BR-01`..`BR-08`), ma trận RBAC |

> Tài liệu phục vụ viết Báo cáo Đồ án Chuyên ngành (bản thảo Chương 2, Chương 3, file `.docx` và script Python sinh sơ đồ) được lưu tách biệt tại `docs/report/`.

---

## 2. Quy Ước Kỹ Thuật Bất Biến (Không Tự Ý Phá Vỡ Hợp Đồng FE–BE)

| Hạng mục | Quy ước bắt buộc | Chi tiết tham chiếu |
|---|---|---|
| **Vai trò (`ROLES`)** | Chỉ có **3 vai trò** đăng nhập: `'admin'`, `'staff'`, `'student'` (không có `manager` hay `viewer`) | `src/shared/constants/enums.js` |
| **Envelope API** | `{ code, message, data }` (`code: 'OK'` khi thành công; mã lỗi tiếng Anh in hoa khi thất bại) | `docs/API.md` §1.1 |
| **Phân trang** | `data: { items, total, page, limit }` (`limit` tối đa `100`, có thể kèm `summary`) | `src/core/utils/http.js` |
| **Định danh JSON** | Trả `id` (`string`), ẩn `_id`, `__v`, `passwordHash`; chuẩn hóa DTO qua `src/shared/views.js` | `src/shared/to-json.js` |
| **Ngày tháng (`UTC+7`)** | Ngày không giờ lưu chuỗi `'YYYY-MM-DD'`; tháng chốt điện nước lưu `'YYYY-MM'` (tính theo giờ VN) | `src/core/utils/dates.js` |
| **Tiền tệ** | Số nguyên VND (`Integer >= 0`), không dùng số thực dấu phẩy động | `docs/DATA-SCHEMA.md` |
| **Giường nhúng & Khóa nguyên tử** | Giường nhúng trong `Room.beds[]`; khóa khi duyệt bằng `Room.findOneAndUpdate` với `$elemMatch: { bedNumber, status: 'available' }` | `docs/ARCHITECTURE.md` §3.1 |
| **Trạng thái hết hạn hợp đồng** | DB lưu `pending | active | terminated | rejected`; trạng thái `expired` suy ra lúc đọc (`active` và `endDate < today()`), vẫn giữ giường tới khi `terminate` | `src/shared/views.js` |
| **Hóa đơn điện nước & Tiền cọc** | Điện nước chốt **01 hóa đơn `scope: 'room'`/phòng/tháng**; tiền cọc tách khỏi doanh thu và chỉ xác nhận hoàn đủ 1 lần (`isDepositRefunded`) sau thanh lý | `BR-03`, `BR-08` |
