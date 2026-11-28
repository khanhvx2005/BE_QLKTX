# HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ ĐẠI HỌC CÔNG NGHIỆP HÀ NỘI (HaUI - DMS)
### BACKEND SERVICE (Node.js + Express 5 + MongoDB + Mongoose 9)

Kho mã nguồn Backend RESTful API của đề tài **Xây dựng hệ thống web Quản lý Ký túc xá Đại học Công nghiệp Hà Nội (`HaUI - DMS`)**, bám sát quy định thực tế của **Trung tâm Hỗ trợ sinh viên HaUI — Ký túc xá Cơ sở 1 (Cầu Diễn)** năm học **2026–2027** (`https://ssc.haui.edu.vn`).

- **Kiến trúc:** Modular Monolith gọn nhẹ (**11 thư mục phân hệ · 11 Collections MongoDB · 4 vai trò RBAC**), không yêu cầu Redis, BullMQ hay Socket.io.
- **Phạm vi KTX Cơ sở 1 (`cs1`):** Ngõ 296 / Số 298 Đường Cầu Diễn, Phường Tây Tựu, TP. Hà Nội — **2 tòa nhà `A14` & `A15`**, tổng **40 phòng** (>30m² khép kín, 5 tầng × 4 phòng/tầng), phân bổ **40% Chất lượng cao (16 phòng)** và **60% Tiêu chuẩn (24 phòng)**.
- **Quản lý sức chứa cấp Phòng & Giới tính phòng động:** Theo dõi bằng `capacity` và `occupiedCount` nguyên tử (không theo dõi giường lẻ); phòng trống (`gender = null`) tự nhận giới tính của sinh viên đầu tiên và tự mở lại thành phòng Trống khi về `0` người.
- **Luồng nghiệp vụ dịch vụ khép kín:**
  1. **Đăng ký & Xếp phòng tự động 100%:** Phân luồng tự động Tân SV vs Năm 2+ theo 4 số đầu MSSV (`YYYY60xxxx`) → khóa loại phòng đã kín → tự động xếp chỗ từ tầng thấp lên cao → cấp tài khoản SV (`TK = MK = MSSV`) → phát hành **01 hóa đơn gộp đầu kỳ** (`initial_payment` = Tiền phòng cả kỳ + Tiền cọc tài sản, hạn 7 ngày, triệt tiêu deadlock đóng dở 1 nửa).
  2. **Thanh toán VietQR & Check-in QR:** Webhook VietQR tự động (kèm Sandbox Simulator) gạch nợ 1 chạm → tự kích hoạt `active` & sinh mã **QR Check-in** (`QRC-HD-...`). Báo cáo doanh thu tự động loại trừ phần tiền cọc khỏi `initial_payment`.
  3. **Vận hành nội trú chặt chẽ:** Chưa Check-in chưa được gửi báo hỏng/chuyển phòng và chưa bị chia tiền điện nước tháng; chuyển phòng giữa kỳ yêu cầu sạch nợ cá nhân + điện nước phòng cũ, cùng hạng & sức chứa và chỉ Trưởng ban KTX phê duyệt 1 lần duy nhất (`completed`).
  4. **Trả phòng, Thanh lý & Hoàn cọc:** Phiếu trả phòng (`checkout`) liên kết một nguồn sự thật với bước `Thanh lý hợp đồng` (kiểm tra sạch nợ từ tháng Check-in trở đi, nhả chỗ và tự đóng phiếu `checkout` sang `completed`) → quyết toán hoàn cọc có khấu trừ hư hại tài sản và tự lập phiếu chi `REF-...`.

---

## 1. Bảng giá KTX Cơ sở 1 áp dụng (Năm học 2026–2027)

| Hạng phòng | Loại phòng | Đơn giá (VNĐ/SV/tháng) | Tiền cọc tài sản | Trang thiết bị |
|---|---|---:|---:|---|
| **Chất lượng cao (`high_quality`)** | 3 người | 930.000 | 500.000 | Điều hòa, bình nóng lạnh, quạt trần, tủ cá nhân, giường gỗ, đệm, Wifi, khép kín >30m² |
| **Chất lượng cao (`high_quality`)** | 4 người | 700.000 | 500.000 | Điều hòa, bình nóng lạnh, quạt trần, tủ cá nhân, giường tầng, đệm, Wifi, khép kín >30m² |
| **Chất lượng cao (`high_quality`)** | 6 người | 470.000 | 500.000 | Điều hòa, bình nóng lạnh, quạt trần, tủ cá nhân, giường tầng, đệm, Wifi, khép kín >30m² |
| **Tiêu chuẩn (`standard`)** | 4 người | 550.000 | 500.000 | Bình nóng lạnh, quạt trần, tủ cá nhân, giường tầng, Wifi, khép kín >30m² |
| **Tiêu chuẩn (`standard`)** | 6 người | 380.000 | 500.000 | Bình nóng lạnh, quạt trần, tủ cá nhân, giường tầng, Wifi, khép kín >30m² |

- **2 gói kỳ hạn lưu trú:** Nửa năm (`6_months` — 1 học kỳ) và 1 năm (`12_months` — cả năm học).

---

## 2. Yêu cầu môi trường & Cài đặt

- **Node.js:** `>= 18.x` (khuyến nghị `>= 20.x`) và `npm`.
- **MongoDB:** `>= 6.0` (chạy cục bộ bằng Docker container hoặc MongoDB cài máy / MongoDB Atlas).

```bash
# 1. Cài đặt thư viện phụ thuộc
npm install

# 2. Tạo file .env từ mẫu chuẩn
cp .env.example .env

# 3. Khởi tạo dữ liệu mẫu KTX Cơ sở 1 (chỉ chạy trên DB cục bộ)
npm run seed

# 4. Chạy server phát triển (cổng 5000)
npm run dev
# hoặc chạy trực tiếp:
npm start
```

Địa chỉ sau khi khởi chạy:
- **Server:** `http://localhost:5000`
- **Health Check:** `http://localhost:5000/api/health`
- **Base API URL:** `http://localhost:5000/api`

---

## 3. Cấu hình biến môi trường (`.env`)

Xem đầy đủ tại [.env.example](.env.example). Các nhóm biến chính:
- `PORT`, `NODE_ENV`: Cổng lắng nghe (mặc định `5000`) và chế độ môi trường.
- `MONGODB_URI`: Chuỗi kết nối MongoDB (mặc định `mongodb://localhost:27017/dms_ktx`; không commit `.env` lên Git).
- `SEED_ALLOW_REMOTE`: Mặc định `false` để chặn `npm run seed` vô tình xóa cụm Atlas dùng chung.
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`: Cấu hình JWT (hạn mặc định `7d`) và băm mật khẩu.
- `CORS_ORIGIN`, `FRONTEND_URL`: Nguồn Frontend React Vite (mặc định `http://localhost:5173`).
- `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NUMBER`, `VIETQR_ACCOUNT_NAME`, `VIETQR_WEBHOOK_SECRET`: Thông tin sinh mã VietQR NAPAS 247 và mã bí mật xác thực Webhook (`x-webhook-secret`).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`: Cấu hình gửi email Nodemailer (nếu để trống, hệ thống ghi log và bỏ qua gửi thật).

---

## 4. Danh sách 12 Tài khoản Mẫu (sau khi chạy `npm run seed`)

### Cổng Cán bộ (`portal: 'admin'`)
| Vai trò | Email đăng nhập | Mật khẩu | Phạm vi & Kịch bản kiểm thử |
|---|---|---|---|
| **Quản trị hệ thống (`admin`)** | `admin@dorm.local` | `Admin@123` | Chỉ quản trị tài khoản người dùng (tách biệt khỏi nghiệp vụ KTX và doanh thu) |
| **Trưởng ban QLKTX (`manager`)** | `manager@dorm.local` | `Manager@123` | Mở đợt đăng ký, cấu hình Tòa/Phòng, duyệt chuyển phòng 2A, **độc quyền xem Báo cáo Doanh thu** |
| **Cán bộ quản sinh (`staff`)** | `staff@dorm.local` | `Staff@123` | Vận hành hằng ngày: SV, QR Check-in, thanh lý, hoàn cọc, điện nước, thu tiền, báo hỏng, bảng tin |
| **Cán bộ bị khóa (`staff`)** | `staff2@dorm.local` | `Staff@123` | Kiểm thử chặn đăng nhập `403 ACCOUNT_LOCKED` |
| **Cán bộ mới (`staff`)** | `doimk@dorm.local` | `Tam@12345` | Kiểm thử cưỡng bức đổi mật khẩu lần đầu (`mustChangePassword`) |

### Cổng Sinh viên (`portal: 'student'` — đăng nhập bằng Email hoặc MSSV)
| Email | MSSV | Mật khẩu | Kịch bản kiểm thử sẵn có |
|---|---|---|---|
| `sv001@dorm.local` | `2024600001` | `Student@123` | Đang ở `A14-101` (CLC 3 kín), còn 1 hóa đơn điện nước chưa nộp + 1 phiếu báo hỏng |
| `sv002@dorm.local` | `2024600002` | `Student@123` | Đang ở `A15-103` (CLC 4 Nữ), sạch nợ — test chuyển phòng cùng hạng 2A (`A15-202`), trả phòng & in HĐ A4 |
| `sv003@dorm.local` | `2024600041` | `Student@123` | Cựu nội trú đã hoàn đủ 500k cọc — test đăng ký gia hạn tự động trên Portal |
| `sv004@dorm.local` | `2026600053` | `Student@123` | Đang `pending_payment` tại `A14-301` với 01 hóa đơn gộp `initial_payment` — test VietQR Sandbox 1A + quy tắc chưa Check-in 3A |
| `sv005@dorm.local` | `2026600055` | `Student@123` | Đang `pending_payment` quá hạn 2 ngày tại `A15-403` — test Hủy quá hạn nhả chỗ & reset phòng Trống |
| `sv006@dorm.local` | `2024600043` | `Student@123` | Hợp đồng `terminated` chưa hoàn cọc — test quyết toán hoàn cọc có danh mục khấu trừ |
| `sv007@dorm.local` | `2026600051` | `2026600051` | Tân SV vừa cấp tài khoản (`TK = MK = MSSV`, bắt buộc đổi mật khẩu lần đầu) |

---

## 5. Cấu trúc Thư mục Dự án

```text
BE_QLKTX/
├── docs/                         # Tài liệu phân tích thiết kế, API & báo cáo đồ án
├── src/
│   ├── app.js                    # Khởi tạo Express 5, CORS, gắn route các phân hệ & xử lý lỗi tập trung
│   ├── server.js                 # Kết nối MongoDB & Graceful Shutdown
│   ├── core/                     # config, email, errors, logger, middlewares (JWT + RBAC), utils
│   ├── shared/                   # constants/enums.js (bảng giá CS1 2026–2027), views.js (DTO + bộ lọc nợ/cư trú)
│   ├── modules/                  # 11 thư mục phân hệ nghiệp vụ độc lập
│   │   ├── auth/                 # Xác thực (/api/auth) & Quản trị tài khoản (/api/users)
│   │   ├── students/             # Hồ sơ SV, kiểm tra khóa theo MSSV, Import Excel (/api/students)
│   │   ├── rooms/                # Tòa nhà A14/A15 & Phòng cấp Phòng (/api/buildings, /api/rooms)
│   │   ├── periods/              # Đợt đăng ký & phân luồng khóa/ngành (/api/periods)
│   │   ├── contracts/            # Cổng công khai (/api/public), đăng ký tự động, QR Check-in, thanh lý, hoàn cọc (/api/contracts)
│   │   ├── fees/                 # Bảng ghi điện nước nối tiếp chỉ số (3A) & Hóa đơn (/api/utility-readings, /api/invoices)
│   │   ├── payments/             # Thu tiền mặt, Webhook VietQR tự động + Simulator, Phiếu chi hoàn cọc (/api/payments)
│   │   ├── requests/             # Phiếu Báo hỏng / Chuyển phòng cùng hạng (2A) / Trả phòng (/api/requests)
│   │   ├── notifications/        # Bảng tin KTX ưu tiên 3 mức & Chuông thông báo SV (/api/notifications)
│   │   ├── portal/               # Cổng tự phục vụ SV (/api/portal)
│   │   └── dashboard/            # Thống kê CS1 & Báo cáo Doanh thu tách cọc chỉ Manager (/api/dashboard)
│   └── scripts/
│       ├── seed.js               # Nạp dữ liệu mẫu KTX Cơ sở 1 (40 phòng, 110 SV, 12 tài khoản)
│       ├── test-db.js            # Kiểm tra kết nối MongoDB
│       └── test-haui-dms.js      # Bộ kiểm thử tích hợp RESTful API (11 nhóm test tự động)
├── .env.example
└── package.json
```

---

## 6. Các lệnh NPM Scripts

| Lệnh | Mục đích |
|---|---|
| `npm run dev` | Khởi chạy server phát triển với `nodemon` |
| `npm start` | Khởi chạy server bằng `node src/server.js` |
| `npm run db:test` | Kiểm tra kết nối tới MongoDB cấu hình trong `.env` |
| `npm run seed` | Nạp lại bộ dữ liệu mẫu KTX Cơ sở 1 (40 phòng · 110 SV · 12 tài khoản) |
| `npm test` | Chạy bộ kiểm thử tích hợp tự động (`src/scripts/test-haui-dms.js`) — khuyến nghị chạy trên DB test cục bộ như `dms_ktx_test` |
