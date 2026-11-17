# HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ ĐẠI HỌC CÔNG NGHIỆP HÀ NỘI (HaUI - DMS)
### BACKEND SERVICE (Node.js + Express + MongoDB)

> ⚠️ **LƯU Ý QUAN TRỌNG:** Toàn bộ mã nguồn phát triển và cập nhật mới nhất của dự án nằm ở nhánh **`develop`** (không dùng nhánh `main`). Vui lòng checkout đúng nhánh `develop` trước khi cài đặt và chạy ứng dụng.

---

## 1. Yêu cầu môi trường (Prerequisites)

- **Node.js:** Phiên bản `>= 18.x` hoặc `>= 20.x` (khuyến nghị Node 20 LTS trở lên).
- **Trình quản lý gói:** `npm` (đi kèm Node.js).
- **Cơ sở dữ liệu:** 
  - Đã có sẵn chuỗi kết nối **MongoDB Atlas** dùng chung của nhóm (cấu hình trong `.env`).
  - Hoặc MongoDB cài cục bộ tại máy: `mongodb://localhost:27017/dms_ktx`.

---

## 2. Hướng dẫn Clone & Cài đặt dự án

### Bước 1: Clone kho mã nguồn và chuyển sang nhánh `develop`

```bash
# Clone repository
git clone https://github.com/khanhvx2005/BE_QLKTX.git

# Di chuyển vào thư mục dự án
cd BE_QLKTX

# Chuyển sang nhánh develop
git checkout develop

# Cập nhật code mới nhất từ remote
git pull origin develop
```

### Bước 2: Cài đặt các thư viện phụ thuộc (Dependencies)

```bash
npm install
```

---

## 3. Cấu hình biến môi trường (`.env`)

Tạo một file `.env` tại thư mục gốc của dự án `BE_QLKTX` (hoặc kiểm tra file `.env` đã có sẵn) với nội dung mẫu chuẩn dưới đây:

```env
# --- Cấu hình Ứng dụng ---
NODE_ENV=development
PORT=5000

# --- Cơ sở dữ liệu MongoDB ---
# Kết nối cụm MongoDB Atlas (CSDL dùng chung của nhóm):
MONGODB_URI=mongodb+srv://khanhvuxuan292005_db_user:7UlAJ35N47ecef21@cluster0.yh2j7gk.mongodb.net/dms_ktx?retryWrites=true&w=majority&authSource=admin

# Cho phép seed dữ liệu vào cụm Atlas (true/false)
SEED_ALLOW_REMOTE=true

# --- Cấu hình Xác thực JWT & Bảo mật ---
JWT_SECRET=super_secret_jwt_key_haui_dms_team5_development_2026
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10

# --- Cấu hình CORS (Cho phép Frontend kết nối) ---
CORS_ORIGIN=http://localhost:5173

# --- Cấu hình Email SMTP (Gửi tài khoản tự động khi duyệt đơn KTX) ---
# Điền tài khoản Gmail và Mật khẩu ứng dụng (App Password) của bạn nếu muốn gửi email thật
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=Ký túc xá Đại học Công nghiệp Hà Nội (HaUI - DMS)

# --- Trình lập lịch tác vụ nền ---
ENABLE_CRON=true
TZ=Asia/Ho_Chi_Minh
```

> **Ghi chú về Email:** Nếu chưa điền `SMTP_USER` và `SMTP_PASS`, hệ thống vẫn hoạt động bình thường và ghi thông tin tài khoản cấp mới vào log hệ thống để cán bộ sao chép thủ công.

---

## 4. Khởi tạo dữ liệu mẫu (Seed Database)

Để tạo sẵn dữ liệu mẫu (tòa nhà K1-K3, các phòng, giường, hóa đơn mẫu và các tài khoản đăng nhập):

```bash
npm run seed
```

Khi chạy thành công, Terminal sẽ hiển thị:
```text
[SEED] Kết nối dms_ktx — xóa dữ liệu cũ
[SEED] ✅ Xong: 90 SV · 20 phòng · 79 hợp đồng · 182 hóa đơn · 173 phiếu thu · 49 chỉ số · 14 tài khoản
[SEED] Đăng nhập: 
  - Admin:   admin@dorm.local / Admin@123
  - Cán bộ:  staff@dorm.local / Staff@123
  - Sinh viên: sv001@dorm.local / Student@123
```

---

## 5. Khởi chạy Server Backend

### Chế độ Development (Tự động tải lại khi sửa code với Nodemon):
```bash
npm run dev
```

### Chế độ Production:
```bash
npm start
```

Sau khi khởi chạy thành công:
- **Server chạy tại:** `http://localhost:5000`
- **Kiểm tra trạng thái Health check:** `http://localhost:5000/api/health`
- **Tiền tố API:** `http://localhost:5000/api/...`

---

## 6. Danh sách Tài khoản Đăng nhập Mặc định

Hệ thống đã chuẩn bị sẵn bộ tài khoản thử nghiệm theo các vai trò:

| Vai trò (Role) | Email / Tên đăng nhập | Mật khẩu | Ghi chú |
|---|---|---|---|
| **Quản trị viên (Admin)** | `admin@dorm.local` | `Admin@123` | Toàn quyền cấu hình tòa nhà, người dùng, xem báo cáo |
| **Cán bộ KTX (Staff)** | `staff@dorm.local` | `Staff@123` | Duyệt đơn, xếp giường, chốt điện nước, thu tiền |
| **Cán bộ KTX (Test đổi MK)** | `doimk@dorm.local` | `Tam@12345` | Bắt buộc đổi mật khẩu mới ở lần đăng nhập đầu |
| **Sinh viên (Student)** | `sv001@dorm.local` | `Student@123` | Sinh viên đang ở, có hóa đơn công nợ |
| **Sinh viên (Student)** | `sv003@dorm.local` | `Student@123` | Sinh viên đang ở, đã đóng hết các khoản nợ |
| **Sinh viên mới tạo qua duyệt** | Sử dụng chính `MSSV` | Mật khẩu là `MSSV` | Tự động tạo khi cán bộ bấm duyệt đơn đăng ký online |

---

## 7. Cấu trúc thư mục Backend

```text
BE_QLKTX/
├── docs/                     # Tài liệu thiết kế hệ thống, SRS, Data Schema, Báo cáo
├── src/
│   ├── app.js                # Khởi tạo Express app, middleware, routes
│   ├── server.js             # Bootstrap kết nối MongoDB & lắng nghe port
│   ├── core/
│   │   ├── config/           # Cấu hình env, kết nối MongoDB
│   │   ├── cron/             # Scheduler tác vụ định kỳ
│   │   ├── email/            # Dịch vụ gửi email thông báo tự động (Nodemailer)
│   │   ├── logger/           # Ghi log tập trung (Winston)
│   │   ├── middlewares/      # Middleware xác thực JWT, phân quyền RBAC, xử lý lỗi
│   │   └── utils/            # Tiện ích tạo mã, ngày tháng, định dạng phản hồi
│   ├── modules/              # Các phân hệ nghiệp vụ (Modular Monolith)
│   │   ├── auth/             # Đăng nhập, đổi mật khẩu, phân quyền
│   │   ├── contracts/        # Đăng ký online, duyệt đơn, hợp đồng KTX
│   │   ├── fees/             # Điện nước bảng lưới, phát hành hóa đơn phòng
│   │   ├── payments/         # Thanh toán tiền mặt, sinh mã VietQR động
│   │   ├── rooms/            # Quản lý tòa nhà, phòng & giường nhúng
│   │   └── students/         # Quản lý hồ sơ sinh viên, import Excel
│   ├── scripts/              # Script khởi tạo dữ liệu mẫu (seed.js), test API
│   └── shared/               # Định nghĩa Enum, mã lỗi, view dữ liệu chung
├── .env                      # File biến môi trường
├── package.json              # Khai báo dependencies và scripts
└── README.md                 # Hướng dẫn cài đặt và vận hành
```

---

## 8. Các lệnh hữu ích (NPM Scripts)

- `npm run dev`: Chạy server chế độ dev với nodemon (cổng 5000).
- `npm start`: Chạy server chế độ thông thường.
- `npm run seed`: Xóa sạch và nạp lại dữ liệu mẫu vào CSDL.
- `npm run test`: Chạy bộ kiểm thử tự động toàn diện các kịch bản API KTX HaUI.
