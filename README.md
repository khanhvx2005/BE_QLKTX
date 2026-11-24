# HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ ĐẠI HỌC CÔNG NGHIỆP HÀ NỘI (HaUI - DMS v3.0)
### BACKEND SERVICE (Node.js + Express 5 + MongoDB + Mongoose 9)

Kho mã nguồn Backend RESTful API của đề tài **Xây dựng hệ thống web Quản lý Ký túc xá Đại học Công nghiệp Hà Nội (`HaUI - DMS`)**, chuẩn hóa theo nghiệp vụ thực tế Trung tâm Hỗ trợ sinh viên HaUI năm học **2026–2027** (`ssc.haui.edu.vn`):
- **Kiến trúc:** Modular Monolith gọn nhẹ (**10 Phân hệ · 11 Collections · 4 Vai trò RBAC**), không cần Redis/BullMQ hay Socket.io.
- **3 Cơ sở HaUI (Địa giới hành chính 2026):**
  - **Cơ sở 1 (`cs1`):** Ngõ 296 / Số 298 Đường Cầu Diễn, Phường Tây Tựu, TP. Hà Nội (**A14, A15**).
  - **Cơ sở 2 (`cs2`):** Tổ dân phố Thượng 2, Phường Tây Tựu, TP. Hà Nội (**B12, B14**).
  - **Cơ sở 3 (`cs3`):** Phường Phù Vân, Tỉnh Ninh Bình (**C15, C16, C17**).
- **Quản lý tinh gọn cấp Phòng:** Quản lý chỗ ở bằng `capacity` & `occupiedCount` nguyên tử (sinh viên vào phòng tự sắp xếp giường với nhau), bám sát **bảng giá 2026–2027**.
- **Số hóa tự động khép kín:** Đợt đăng ký & phân luồng tự động Tân SV vs Năm 2+ theo 4 số đầu MSSV (`YYYY60xxxx`) → Duyệt ưu tiên & giữ chỗ `pending_payment` (hạn 7 ngày, tự hủy quá hạn) → **Webhook VietQR tự động gạch nợ + Simulator** → Tự kích hoạt `active` & cấp **Mã QR Check-in** → Điện nước bảng lưới nối tiếp chỉ số → Phiếu Báo hỏng / Chuyển phòng nguyên tử / Trả phòng → Hoàn cọc có khấu trừ hỏng đồ.

---

## 1. Yêu cầu môi trường (Prerequisites)

- **Node.js:** Phiên bản `>= 18.x` hoặc `>= 20.x`.
- **Trình quản lý gói:** `npm`.
- **Cơ sở dữ liệu:** MongoDB `>= 6.0` (cài cục bộ `mongodb://localhost:27017/dms_ktx` hoặc **MongoDB Atlas**).

---

## 2. Hướng dẫn Cài đặt & Khởi chạy

```bash
# 1. Cài đặt thư viện phụ thuộc
npm install

# 2. Tạo file .env từ mẫu chuẩn (điền chuỗi kết nối MongoDB của bạn)
cp .env.example .env

# 3. Khởi tạo dữ liệu mẫu 3 cơ sở HaUI 2026–2027 (chỉ chạy trên DB local hoặc khi cả nhóm đồng ý)
npm run seed

# 4. Chạy server chế độ phát triển (Nodemon tại cổng 5000)
npm run dev
```

Sau khi khởi chạy thành công:
- **Server:** `http://localhost:5000`
- **Health Check:** `http://localhost:5000/api/health`
- **Base API URL:** `http://localhost:5000/api`

---

## 3. Cấu hình biến môi trường (`.env`)

Xem đầy đủ tại [.env.example](.env.example). Các nhóm biến chính:
- `MONGODB_URI`: Chuỗi kết nối MongoDB (tuyệt đối **không commit mật khẩu thật** lên Git).
- `SEED_ALLOW_REMOTE`: Mặc định `false` để bảo vệ cụm MongoDB Atlas khỏi lệnh xóa trắng của `npm run seed`.
- `JWT_SECRET`, `JWT_EXPIRES_IN`: Chữ ký số và thời hạn phiên đăng nhập (mặc định `7d`).
- `CORS_ORIGIN`, `FRONTEND_URL`: Địa chỉ ứng dụng React Vite (mặc định `http://localhost:5173`).
- `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NUMBER`, `VIETQR_ACCOUNT_NAME`, `VIETQR_WEBHOOK_SECRET`: Thông tin nhận VietQR động và khóa bảo mật xác thực Webhook báo có (`x-webhook-secret`).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Cấu hình gửi email tự động (duyệt đơn, từ chối, gửi mã QR Check-in, báo tiền điện nước). Nếu để trống, hệ thống vẫn vận hành bình thường và ghi log.

---

## 4. Danh sách Tài khoản Mẫu (sau khi chạy `npm run seed`)

| Vai trò (Role) | Email / Tên đăng nhập | Mật khẩu | Vai trò & Tình huống kiểm thử |
|---|---|---|---|
| **Quản trị Hệ thống (`admin`)** | `admin@dorm.local` | `Admin@123` | Chỉ quản trị tài khoản, phân quyền, khóa/mở TK (tách biệt khỏi vận hành KTX & doanh thu) |
| **Trưởng ban QLKTX (`manager`)** | `manager@dorm.local` | `Manager@123` | Mở đợt đăng ký, cấu hình 3 cơ sở/tòa/phòng, duyệt chuyển phòng, **độc quyền xem Báo cáo Doanh thu** |
| **Cán bộ Quản sinh (`staff`)** | `staff@dorm.local` | `Staff@123` | Vận hành hằng ngày: SV, duyệt/hủy đơn, quét QR Check-in, điện nước, thu tiền, xử lý báo hỏng |
| **Cán bộ bị khóa (`staff`)** | `staff2@dorm.local` | `Staff@123` | Kiểm thử chặn đăng nhập `403 ACCOUNT_LOCKED` |
| **Cán bộ mới (`staff`)** | `doimk@dorm.local` | `Tam@12345` | Kiểm thử cưỡng bức đổi mật khẩu lần đầu (`mustChangePassword`) |
| **SV đang ở CS1 (`student`)** | `sv001@dorm.local` | `Student@123` | Đang nội trú phòng A14-101, còn hóa đơn điện nước phòng chưa nộp |
| **SV sạch nợ CS1 (`student`)** | `sv002@dorm.local` | `Student@123` | Đang nội trú phòng A15-101, sạch nợ, sẵn sàng thử báo hỏng / chuyển phòng |
| **SV năm 2+ chưa ở (`student`)** | `sv003@dorm.local` | `Student@123` | Kiểm thử đăng ký / gia hạn nội bộ (`POST /api/portal/applications`) |
| **SV chờ đóng phí CS3 (`student`)** | `sv004@dorm.local` | `Student@123` | Hợp đồng `pending_payment` tại C15-102 — thử **Webhook VietQR tự kích hoạt & sinh QR Check-in** |
| **SV quá hạn đóng phí (`student`)** | `sv005@dorm.local` | `Student@123` | Hợp đồng `pending_payment` quá hạn — thử `POST /api/contracts/cancel-overdue` |
| **SV chờ hoàn cọc (`student`)** | `sv006@dorm.local` | `Student@123` | Hợp đồng `terminated` chưa hoàn cọc — thử khấu trừ hỏng đồ khi hoàn cọc |
| **SV mới được duyệt (`student`)** | `sv007@dorm.local` *(hoặc MSSV `YYYY600031`)* | *Trùng MSSV* | Kiểm thử cưỡng bức đổi mật khẩu lần đầu (`TK = MK = MSSV`) |

---

## 5. Cấu trúc Thư mục Dự án (10 Phân hệ · 11 Collections)

```text
BE_QLKTX/
├── .agents/rules/gemini.md       # Quy ước kiến trúc & chuẩn kỹ thuật toàn dự án
├── docs/                         # Bộ tài liệu chuẩn hóa v3.0 & Báo cáo đồ án
│   ├── PRD.md                    # Phạm vi sản phẩm, 3 cơ sở HaUI & Bảng giá 2026–2027
│   ├── ARCHITECTURE.md           # Kiến trúc Modular Monolith 10 phân hệ
│   ├── EDIT_DOCS_DATA_SCHEMA.md  # ERD & thiết kế 11 Collections MongoDB
│   ├── EDIT_DOCS_DAC_TA_YEU_CAU.md # Đặc tả yêu cầu phần mềm (SRS: 4 Roles, FR, BR)
│   ├── API.md                    # Hợp đồng RESTful API v3.0 đầy đủ (FE ↔ BE)
│   └── report/                   # Bản thảo các chương báo cáo Đồ án & Script sinh sơ đồ
├── src/
│   ├── app.js                    # Khởi tạo Express 5, CORS, định tuyến 10 phân hệ, bắt lỗi
│   ├── server.js                 # Kết nối MongoDB + Graceful Shutdown
│   ├── core/                     # Hạ tầng dùng chung (config, email, errors, logger, middlewares, utils)
│   ├── shared/                   # Hằng số enum (bảng giá 2026–2027), mã lỗi chuẩn, DTO views
│   ├── modules/                  # 10 phân hệ nghiệp vụ độc lập
│   │   ├── auth/                 # M1: Xác thực (/api/auth) & Quản trị tài khoản (/api/users)
│   │   ├── students/             # M2: Hồ sơ SV HaUI, trích xuất khóa MSSV, Import Excel (/api/students)
│   │   ├── rooms/                # M3: 3 Cơ sở, Tòa nhà & Phòng cấp Phòng (/api/buildings, /api/rooms)
│   │   ├── periods/              # M4: Đợt đăng ký & phân luồng khóa/ngành (/api/periods)
│   │   ├── contracts/            # M5: Cổng công khai (/api/public) & Hợp đồng / QR Check-in (/api/contracts)
│   │   ├── fees/                 # M6: Điện nước nối tiếp chỉ số & Hóa đơn phòng (/api/utility-readings, /api/invoices)
│   │   ├── payments/             # M7: Cash, Webhook VietQR tự động + Simulator, Phiếu chi hoàn cọc (/api/payments)
│   │   ├── requests/             # M8: Phiếu Báo hỏng / Chuyển phòng nguyên tử / Trả phòng (/api/requests)
│   │   ├── notifications/        # M9: Bảng tin KTX công khai & Chuông thông báo (/api/notifications)
│   │   ├── portal/               # M10a: Cổng tự phục vụ SV (/api/portal)
│   │   └── dashboard/            # M10b: Thống kê 3 cơ sở & Doanh thu riêng Manager (/api/dashboard)
│   └── scripts/                  # Khởi tạo dữ liệu mẫu (seed.js) & Kiểm thử tích hợp (test-haui-dms.js)
├── .env.example
└── package.json
```

---

## 6. Các lệnh NPM Scripts

- `npm run dev`: Chạy server chế độ phát triển với `nodemon`.
- `npm start`: Chạy server chế độ Production.
- `npm run db:test`: Kiểm tra kết nối tới MongoDB.
- `npm run seed`: Khởi tạo lại bộ dữ liệu mẫu v3.0 đầy đủ 3 cơ sở HaUI.
- `npm test`: Chạy bộ kiểm thử tự động RESTful API v3.0 (`src/scripts/test-haui-dms.js`) trên CSDL cục bộ.
