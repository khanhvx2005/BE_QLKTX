# Project Architecture Overview (Kiến trúc Hệ thống)

**Project:** Dormitory Management System - HaUI (DMS-KTX HaUI)  
**Version:** v2.0 (Hợp nhất theo kiến trúc KTX 4.0 chịu tải cao)  
**Pattern:** Modular Monolith — Feature-Based (Vertical Slice) Organization  
**Audience:** Developers (Backend, Frontend) & Hội đồng đánh giá đồ án KTPM  

---

## 1. Nguyên tắc kiến trúc cốt lõi

1. **Tổ chức theo tính năng (Feature-Driven Vertical Slice):** Nhóm mã nguồn theo nghiệp vụ (`applications`, `rooms`, `contracts`, `invoices`, `utilities`, `chats`...) thay vì nhóm kỹ thuật thuần túy (`controllers/`, `models/`). Mỗi module tự quản lý schema, route, controller, service và validation.
2. **Kiến trúc chịu tải cao (High Concurrency & Flash-Spike Resilience):**
   - Sử dụng **Redis In-Memory** làm bộ nhớ đệm (Cache-Aside) cho dữ liệu tra cứu phòng trống (`rooms:available:campus:{id}`) với độ trễ < 2ms;
   - Sử dụng **Hàng đợi Message Queue (BullMQ trên nền Redis)** để tiếp nhận đơn nộp đợt cao điểm trong 5ms và dàn phẳng tải (Traffic Smoothing) xuống MongoDB.
3. **Tính toàn vẹn dữ liệu & Cập nhật nguyên tử (Atomicity without Distributed Locks):** Sử dụng thao tác `findOneAndUpdate` có điều kiện nguyên tử của MongoDB (`{ _id: bedId, status: 'available' }`) để triệt tiêu 100% nguy cơ xếp trùng giường.
4. **Giao tiếp thời gian thực (Real-time Engine):** Tích hợp **Socket.io** trên nền Redis Adapter phục vụ kênh chat trực tuyến giữa sinh viên và cán bộ trực KTX cũng như đẩy thông báo chuông cá nhân.

---

## 2. Sơ đồ kiến trúc tổng thể (High-Level System Diagram)

```
┌──────────────────────────────────────┐                ┌──────────────────────────────────────┐
│       Frontend (React + Vite)        │   HTTPS/JSON   │        Backend (Express.js)          │
│ • Admin/Staff Portal (/admin/*)      │ ─────────────► │        Modular Monolith              │
│ • Public & Student Portal (/portal/*)│ ◄───────────── │ • RESTful Controllers                │
│ • Socket.io-client (Chat & Notif)    │ ◄──WebSocket──►│ • Core Services & Middlewares (RBAC) │
└──────────────────────────────────────┘                └───────────┬──────────────┬───────────┘
                                                                    │              │
                                                   Mongoose ODM     │              │ BullMQ / Cache
                                                                    ▼              ▼
                                                        ┌────────────────┐   ┌────────────────┐
                                                        │    MongoDB     │   │     Redis      │
                                                        │ 19 Collections │   │ • Job Queues   │
                                                        │ Partial Unique │   │ • Cache-Aside  │
                                                        │    Indexes     │   │ • Socket.io    │
                                                        └────────────────┘   └────────────────┘
                                                                    ▲              ▲
                                                                    │              │
                                                       ┌────────────┴──────────────┴───────────┐
                                                       │            External Services          │
                                                       │ • VietQR Napas247 (Dynamic QR)        │
                                                       │ • VNPay Sandbox Gateway (Webhook)     │
                                                       │ • SMTP Server (Nodemailer Queue)      │
                                                       └───────────────────────────────────────┘
```

---

## 3. Cấu trúc thư mục Backend (`backend/src`)

```
backend/
├── src/
│   ├── modules/                      # 14 Feature-based Business Modules
│   │   ├── auth/                     # Đăng nhập, đổi mật khẩu lần đầu, hồ sơ cá nhân
│   │   ├── users/                    # Quản trị tài khoản & phân quyền (admin)
│   │   ├── campuses/                 # Quản lý 3 cơ sở (CS1, CS2, CS3) & Tòa nhà
│   │   ├── rooms/                    # Quản lý phòng & giường tầng (lower/upper)
│   │   ├── applications/             # Đợt mở KTX, nộp đơn công khai, BullMQ Worker
│   │   ├── students/                 # Hồ sơ sinh viên nội trú & liên hệ khẩn cấp
│   │   ├── contracts/                # Hợp đồng lưu trú, tạo mã QR Check-in nhận phòng
│   │   ├── utilities/                # Nhập số điện nước theo lô (Grid) & đơn giá
│   │   ├── invoices/                 # Lập hóa đơn, thuật toán chia đều Math.floor
│   │   ├── payments/                 # VietQR động, VNPay IPN Webhook, đối soát
│   │   ├── requests/                 # Đơn xin chuyển phòng, trả phòng & hoàn cọc
│   │   ├── maintenance/              # Phiếu báo hỏng thiết bị & điều phối sửa chữa
│   │   ├── violations/               # Biên bản vi phạm nội quy & điểm rèn luyện
│   │   ├── chats/                    # Socket.io chat thời gian thực sinh viên - cán bộ
│   │   ├── announcements/            # Bảng tin thông báo chung KTX
│   │   ├── notifications/            # Chuông thông báo đẩy cá nhân
│   │   └── reports/                  # Dashboard thống kê, tỷ lệ lấp đầy & xuất file
│   │
│   ├── core/                         # Hạ tầng dùng chung
│   │   ├── config/                   # env, database (MongoDB), redis, mailer
│   │   ├── middlewares/              # authenticate (JWT), authorize (RBAC), validate
│   │   ├── errors/                   # ApiError class, global error handler
│   │   ├── queues/                   # BullMQ queues definition (applicationQueue, mailQueue)
│   │   ├── socket/                   # Socket.io server initialization & handlers
│   │   └── utils/                    # vietqr-generator, date-helpers, math-allocator
│   │
│   ├── shared/                       # Hằng số và định dạng dùng chung
│   │   ├── constants/                # enums: roles, statuses (bed, contract, invoice)
│   │   └── types/                    # DTO shapes
│   │
│   ├── app.js                        # Express app assembly & route registration
│   └── server.js                     # Khởi tạo DB, Redis, Socket.io & HTTP server
├── tests/
└── package.json
```

---

## 4. Kiến trúc Frontend (`frontend/src`)

```
frontend/
├── src/
│   ├── features/                     # Feature-based UI Modules
│   │   ├── auth/                     # Đăng nhập, đổi mật khẩu lần đầu
│   │   ├── portal/                   # Giao diện dành riêng cho sinh viên
│   │   ├── applications/             # Form nộp đơn công khai & Xét duyệt đơn
│   │   ├── campuses/                 # Quản lý cơ sở, tòa nhà
│   │   ├── rooms/                    # Sơ đồ phòng, giường tầng
│   │   ├── students/                 # Danh sách sinh viên nội trú
│   │   ├── contracts/                # Hợp đồng, quét mã QR Check-in
│   │   ├── utilities/                # Bảng nhập điện nước theo lô
│   │   ├── invoices/                 # Hóa đơn & hiển thị mã VietQR động
│   │   ├── payments/                 # Lịch sử giao dịch & đối soát
│   │   ├── requests/                 # Đơn chuyển phòng, trả phòng
│   │   ├── maintenance/              # Báo hỏng thiết bị
│   │   ├── violations/               # Biên bản vi phạm
│   │   ├── chat/                     # Cửa sổ chat Socket.io
│   │   ├── announcements/            # Bảng tin KTX
│   │   └── dashboard/                # Báo cáo biểu đồ
│   │
│   ├── components/                   # UI components dùng chung (StatusTag, MoneyText...)
│   ├── layouts/                      # AdminLayout (Sidebar), PortalLayout (Mobile-First)
│   ├── routes/                       # AppRoutes, RoleRoute (Guarded route per role)
│   ├── lib/                          # axiosClient, socketClient
│   ├── hooks/                        # useApi, useAuth, useSocket
│   ├── context/                      # AuthContext, NotificationContext
│   ├── constants/                    # colors, statuses, API endpoints
│   ├── App.jsx
│   └── main.jsx
├── public/
└── package.json
```

---

## 5. Các giải pháp kỹ thuật nâng cao

### 5.1. Dàn phẳng tải cao điểm bằng BullMQ Queue
- Khi mở cổng nộp đơn KTX, hàng nghìn sinh viên truy cập cùng lúc. Endpoint `POST /api/portal/apply-public` chỉ validate nhanh cấu trúc dữ liệu rồi đẩy payload vào Queue `dorm-application-queue` trên Redis trong ~5ms.
- Background Worker nhặt từng job từ hàng đợi xử lý tuần tự xuống MongoDB với tốc độ kiểm soát (ví dụ: tối đa 80–100 req/s), bảo vệ hoàn toàn cơ sở dữ liệu không bị sập.

### 5.2. Caching Redis giảm tải truy vấn phòng trống
- Sinh viên và phụ huynh liên tục tra cứu danh sách phòng còn trống tại các cơ sở. Hệ thống lưu kết quả truy vấn vào Redis với key `rooms:available:campus:{campusId}` (TTL 30 giây).
- Khi có bất kỳ giao dịch duyệt đơn hoặc nhận phòng làm thay đổi trạng thái giường, cache tự động bị vô hiệu hóa (Cache Invalidation).

### 5.3. Xếp giường nguyên tử (Atomic Conditional Update)
- Để tránh tranh chấp dữ liệu khi nhiều cán bộ cùng thao tác phân phòng, hệ thống áp dụng câu lệnh cập nhật nguyên tử:
```javascript
const bed = await Bed.findOneAndUpdate(
  { _id: bedId, status: 'available' },
  { status: 'occupied' },
  { new: true }
);
if (!bed) {
  throw new ApiError(409, 'BED_NOT_AVAILABLE', 'Giường này vừa được gán cho sinh viên khác');
}
```

---

## 6. Biến môi trường hệ thống

### 6.1. Backend (`backend/.env`)

```bash
# --- App Configuration ---
NODE_ENV=development
PORT=5000
APP_NAME=DMS_KTX_HaUI

# --- Database MongoDB ---
# Kết nối MongoDB cục bộ hoặc MongoDB Atlas replica set
MONGODB_URI=mongodb://localhost:27017/dms_ktx_haui

# --- Redis Configuration ---
# Caching, BullMQ Queues và Socket.io Adapter
REDIS_URL=redis://localhost:6379

# --- Authentication (JWT) ---
JWT_SECRET=super_secret_jwt_key_haui_dormitory_2026
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10

# --- Email Service (SMTP Nodemailer) ---
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=ktx.haui.edu@gmail.com
MAIL_PASS=your_app_password
MAIL_FROM="Ban Quản lý KTX HaUI <ktx.haui.edu@gmail.com>"

# --- VietQR NAPAS 247 ---
VIETQR_BANK_ID=970422
VIETQR_ACCOUNT_NO=112233445566
VIETQR_ACCOUNT_NAME=BAN QUAN LY KTX HAUI
VIETQR_TEMPLATE=compact2

# --- VNPay Sandbox Gateway ---
VNP_TMN_CODE=YOUR_VNP_CODE
VNP_HASH_SECRET=YOUR_VNP_SECRET
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=http://localhost:5173/portal/payment-result

# --- CORS & Security ---
CORS_ORIGIN=http://localhost:5173
```

### 6.2. Frontend (`frontend/.env`)

```bash
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_APP_NAME=Hệ thống Quản lý Ký túc xá - ĐH Công nghiệp Hà Nội
VITE_USE_MOCK=false
```

---

## 7. Lịch sử phiên bản tài liệu

| Phiên bản | Ngày | Người thực hiện | Nội dung thay đổi |
|-----------|------|------------------|-------------------|
| v1.0 | 12/09/2026 | Nhóm phát triển | Khởi tạo cấu trúc kiến trúc Monolith ban đầu |
| **v2.0** | **03/10/2026** | **Lead Kỹ thuật** | **Cập nhật toàn diện kiến trúc KTX 4.0:** Bổ sung Redis In-memory (Cache-Aside + BullMQ Queue chịu tải cao), Socket.io real-time engine, Nodemailer tự động hóa email, VietQR động, mở rộng 14 module chức năng hoàn chỉnh, chuẩn hóa biến môi trường. |
