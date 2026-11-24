# HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ ĐẠI HỌC CÔNG NGHIỆP HÀ NỘI (HaUI - DMS)
### BACKEND SERVICE (Node.js + Express + MongoDB + Mongoose)

Kho mã nguồn Backend RESTful API của đề tài **Xây dựng hệ thống web Quản lý Ký túc xá Đại học Công nghiệp Hà Nội (HaUI - DMS)**, thiết kế theo kiến trúc **Modular Monolith** (8 phân hệ nghiệp vụ, 8 Collections cốt lõi).

---

## 1. Yêu cầu môi trường (Prerequisites)

- **Node.js:** Phiên bản `>= 18.x` hoặc `>= 20.x` (khuyến nghị Node 20 LTS trở lên).
- **Trình quản lý gói:** `npm`.
- **Cơ sở dữ liệu:** MongoDB `>= 6.0` (cài cục bộ `mongodb://localhost:27017/dms_ktx` hoặc cụm **MongoDB Atlas** dùng chung của nhóm).

---

## 2. Hướng dẫn Cài đặt & Khởi chạy

```bash
# 1. Cài đặt thư viện phụ thuộc
npm install

# 2. Tạo file .env từ mẫu chuẩn (điền chuỗi kết nối MongoDB của bạn/nhóm)
cp .env.example .env

# 3. Khởi tạo dữ liệu mẫu (chỉ chạy trên DB local hoặc khi cả nhóm đồng ý seed lại)
npm run seed

# 4. Chạy server chế độ phát triển (tự động reload với Nodemon tại cổng 5000)
npm run dev
```

Sau khi khởi chạy thành công:
- **Server:** `http://localhost:5000`
- **Health Check:** `http://localhost:5000/api/health`
- **Base API URL:** `http://localhost:5000/api`

---

## 3. Cấu hình biến môi trường (`.env`)

Xem chi tiết tại [.env.example](.env.example). Các nhóm biến chính:
- `MONGODB_URI`: Chuỗi kết nối MongoDB (tuyệt đối **không commit mật khẩu thật** lên Git).
- `SEED_ALLOW_REMOTE`: Mặc định `false` để bảo vệ cụm MongoDB Atlas khỏi lệnh xóa trắng của `npm run seed`.
- `JWT_SECRET`, `JWT_EXPIRES_IN`: Chữ ký số và thời hạn phiên đăng nhập (mặc định `7d`).
- `CORS_ORIGIN`, `FRONTEND_URL`: Địa chỉ ứng dụng React Vite (mặc định `http://localhost:5173`).
- `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NUMBER`, `VIETQR_ACCOUNT_NAME`: Tài khoản ngân hàng nhận thanh toán VietQR động.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Cấu hình gửi email tự động khi duyệt/từ chối đơn KTX (nếu để trống hệ thống vẫn hoạt động bình thường và ghi log).

---

## 4. Danh sách Tài khoản Đăng nhập Mẫu (sau khi chạy `npm run seed`)

| Vai trò (Role) | Email / Tên đăng nhập | Mật khẩu | Tình huống kiểm thử |
|---|---|---|---|
| **Quản trị viên (`admin`)** | `admin@dorm.local` | `Admin@123` | Toàn quyền quản lý tài khoản, tòa nhà, phòng, báo cáo doanh thu |
| **Cán bộ KTX (`staff`)** | `staff@dorm.local` | `Staff@123` | Duyệt đơn, quản lý SV, ghi điện nước bảng lưới, thu tiền, thanh lý |
| **Cán bộ bị khóa (`staff`)** | `staff2@dorm.local` | `Staff@123` | Kiểm thử chặn đăng nhập `403 ACCOUNT_LOCKED` |
| **Cán bộ mới (`staff`)** | `doimk@dorm.local` | `Tam@12345` | Kiểm thử cưỡng bức đổi mật khẩu lần đầu (`mustChangePassword`) |
| **Sinh viên đang ở (`student`)** | `sv001@dorm.local` *(hoặc MSSV `2021600001`)* | `Student@123` | Đang nội trú, có hóa đơn công nợ chưa thanh toán |
| **Sinh viên sạch nợ (`student`)** | `sv003@dorm.local` *(hoặc MSSV)* | `Student@123` | Đang nội trú, đã thanh toán đủ công nợ |
| **Sinh viên vừa duyệt (`student`)** | MSSV `2021600005` *(hoặc `sv008@dorm.local`)* | `2021600005` | Tài khoản mới sinh tự động (`TK = MK = MSSV`), bắt buộc đổi mật khẩu |

---

## 5. Cấu trúc Thư mục Dự án

```text
BE_QLKTX/
├── .agents/rules/gemini.md   # Quy ước kiến trúc & chuẩn kỹ thuật toàn dự án
├── docs/                     # Bộ tài liệu chuẩn hóa (Tầng 1 kỹ thuật & Báo cáo đồ án)
│   ├── PRD.md                # Phạm vi sản phẩm & Ranh giới hệ thống
│   ├── ARCHITECTURE.md       # Kiến trúc Modular Monolith & Quy ước kỹ thuật
│   ├── DATA-SCHEMA.md        # Đặc tả 8 Collections MongoDB & Truy vấn nguyên tử
│   ├── API.md                # Hợp đồng RESTful API v2.7 (FE ↔ BE)
│   ├── DAC-TA-YEU-CAU.md     # Đặc tả yêu cầu phần mềm (SRS: FR, NFR, RBAC, BR)
│   └── report/               # Bản thảo các chương báo cáo Đồ án & Script sinh sơ đồ
├── src/
│   ├── app.js                # Khởi tạo Express, CORS, định tuyến 8 phân hệ, bắt lỗi
│   ├── server.js             # Kết nối MongoDB trước khi lắng nghe HTTP + Graceful Shutdown
│   ├── core/                 # Hạ tầng dùng chung (config, email, errors, logger, middlewares, utils)
│   ├── shared/               # Hằng số enum, mã lỗi chuẩn, bộ chuyển đổi dữ liệu trả về (views)
│   ├── modules/              # 8 phân hệ nghiệp vụ độc lập
│   │   ├── auth/             # M1: Xác thực (/api/auth) & Quản lý tài khoản (/api/users)
│   │   ├── students/         # M2: Hồ sơ sinh viên & Import Excel (/api/students)
│   │   ├── rooms/            # M3: Tòa nhà & Phòng KTX giường nhúng (/api/buildings, /api/rooms)
│   │   ├── contracts/        # M4: Cổng công khai (/api/public) & Hợp đồng (/api/contracts)
│   │   ├── fees/             # M5: Điện nước bảng lưới & Hóa đơn (/api/utility-readings, /api/invoices)
│   │   ├── payments/         # M6: Thu tiền mặt & Đối soát VietQR (/api/payments)
│   │   ├── portal/           # M7: Cổng tự phục vụ sinh viên (/api/portal)
│   │   └── dashboard/        # M8: Thống kê lấp đầy & Doanh thu (/api/dashboard)
│   └── scripts/              # Khởi tạo dữ liệu mẫu (seed.js) & Kiểm thử tích hợp (test-haui-dms.js)
├── .env.example              # Mẫu cấu hình biến môi trường
└── package.json              # Khai báo dependencies và scripts
```

---

## 6. Các lệnh NPM Scripts

- `npm run dev`: Chạy server chế độ phát triển với `nodemon`.
- `npm start`: Chạy server chế độ Production.
- `npm run db:test`: Kiểm tra kết nối tới MongoDB.
- `npm run seed`: Khởi tạo lại bộ dữ liệu mẫu phục vụ kiểm thử toàn diện.
- `npm test`: Chạy bộ kiểm thử tự động RESTful API (`src/scripts/test-haui-dms.js`) trên CSDL cục bộ.
