# 16 – YÊU CẦU API VÀ KẾ HOẠCH BÀN GIAO BACKEND

**Hệ thống:** DMS-KTX HaUI (Hệ thống Quản lý Ký túc xá Trường Đại học Công nghiệp Hà Nội)  
**Phiên bản:** v2.0 (Đồng bộ toàn diện với `API.md` v2.0 và CSDL 19 Collections)  
**Người lập:** Backend Lead & Frontend Lead  
**Ngày cập nhật:** 03/10/2026  

---

## 1. Tóm tắt định hướng & Chuẩn hóa cốt lõi

1. **Khớp nối 100% với hợp đồng kỹ thuật tầng 1:**
   - Envelope chuẩn cho mọi response: `{ code: 200, message: "...", data: {...} }`;
   - Chuẩn phân trang: `data: { items: [...], total: 100, page: 1, limit: 20 }`;
   - Tên trường trong JSON và database 100% bằng tiếng Anh; `message` phản hồi tiếng Việt thân thiện với người dùng;
   - Enum hoàn toàn bằng chữ thường (`'active'`, `'pending'`, `'available'`, `'occupied'`, `'male'`, `'female'`).
2. **Loại bỏ hoàn toàn các chức năng thừa so với thực tế KTX công lập HaUI:**
   - ❌ **Loại bỏ Module Cửa hàng Nhu yếu phẩm** (`/supply-items`, `/supply-orders`): KTX không kinh doanh TMĐT.
   - ❌ **Loại bỏ Đăng ký tài khoản tự do** (`POST /auth/register`): Chống spam tài khoản ảo; chuyển thành quy trình nộp đơn công khai theo đợt (`POST /portal/apply-public`) và tự động sinh tài khoản gửi qua Email khi được duyệt trúng tuyển.
   - ❌ **Loại bỏ Đăng ký vắng mặt online**.
3. **Bổ sung các phân hệ KTX 4.0 trọng tâm:**
   - ✅ Hàng đợi **Redis BullMQ** tiếp nhận nộp đơn cao điểm và xếp hàng gửi email;
   - ✅ Bộ nhớ đệm **Redis Cache** cho danh sách phòng trống;
   - ✅ Thuật toán ưu tiên giường tầng dưới cho sinh viên thể chất (`Bed.position: 'lower'`, BR-16);
   - ✅ **Mã VietQR động** chuẩn NAPAS 247 và Webhook Idempotent;
   - ✅ **Quét mã QR Check-in** bàn giao phòng (`/checkin-qr`);
   - ✅ **Socket.io** nhắn tin trực tuyến thời gian thực giữa sinh viên và cán bộ trực KTX.

---

## 2. Bảng tổng hợp 14 Phân hệ API Backend cần bàn giao

| # | Phân hệ API | Prefix Endpoint | Màn hình FE sử dụng | Trạng thái kỹ thuật | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **Xác thực & Người dùng** | `/api/auth`, `/api/users` | SCR-04, 05, 25 | JWT 7 ngày, đổi pass lần đầu, phân quyền 4 vai trò | **P0** |
| **2** | **Cơ cấu không gian** | `/api/campuses`, `/api/rooms` | SCR-14, 15, 31 | 3 Cơ sở HaUI, tòa, phòng, giường (lower/upper), Redis Cache | **P0** |
| **3** | **Đợt mở & Nộp đơn KTX** | `/api/application-periods`, `/api/portal` | SCR-02, 03, 11, 12 | Nộp đơn công khai, BullMQ Queue dàn phẳng tải | **P0** |
| **4** | **Xét duyệt đơn & Cấp tài khoản** | `/api/applications` | SCR-12 | Duyệt trúng tuyển, gán giường nguyên tử, Nodemailer Queue | **P0** |
| **5** | **Sinh viên nội trú** | `/api/students` | SCR-13, 31, 38 | Quản lý hồ sơ, liên hệ khẩn cấp, bạn cùng phòng | **P0** |
| **6** | **Hợp đồng & Check-in QR** | `/api/contracts` | SCR-16, 17, 32, 33 | Vòng đời hợp đồng, sinh mã QR, quét QR nhận phòng | **P0** |
| **7** | **Chỉ số điện nước theo lô** | `/api/utilities` | SCR-18 | Nhập nhanh dạng lưới theo Tòa/Tầng, cảnh báo số âm | **P0** |
| **8** | **Hóa đơn & Chia tiền phòng** | `/api/invoices` | SCR-19, 34 | Thuật toán Math.floor dồn dư MSSV nhỏ nhất | **P0** |
| **9** | **Thanh toán VietQR & Cổng** | `/api/payments` | SCR-20, 34 | Sinh VietQR động Napas247, VNPay IPN Webhook Idempotent | **P0** |
| **10**| **Nghiệp vụ phát sinh** | `/api/requests` | SCR-35 | Đơn chuyển phòng, trả phòng & quyết toán hoàn cọc | **P1** |
| **11**| **Bảo trì, Báo hỏng thiết bị** | `/api/maintenance` | SCR-21, 35 | Tiếp nhận báo hỏng, phân công thợ, cập nhật chi phí | **P1** |
| **12**| **Kỷ luật & Vi phạm nội quy** | `/api/violations` | SCR-22 | Lập biên bản, trừ điểm rèn luyện, xem lịch sử | **P1** |
| **13**| **Tương tác KTX 4.0 (Chat/Notif)**| `/api/chats`, `/api/announcements`| SCR-23, 24, 36, 37 | Socket.io Chat, Chuông thông báo, Bảng tin KTX | **P1** |
| **14**| **Báo cáo & Dashboard** | `/api/reports`, `/api/dashboard` | SCR-10, 26 | Thống kê lấp đầy, doanh thu, công nợ, xuất Excel/CSV | **P1** |

---

## 3. Danh mục Endpoint chi tiết theo nhóm

### 3.1. Nhóm Auth & Quản trị tài khoản
- `POST /api/auth/login`: Đăng nhập (hỗ trợ cả MSSV cho sinh viên và Username/Email cho cán bộ).
- `GET /api/auth/me`: Lấy thông tin phiên làm việc hiện tại từ JWT.
- `POST /api/auth/logout`: Đăng xuất.
- `PATCH /api/auth/change-password`: Đổi mật khẩu thông thường.
- `POST /api/auth/first-time-password`: Cưỡng bức đổi mật khẩu lần đầu và gỡ cờ `mustChangePassword`.
- `GET /api/users`: Quản lý danh sách tài khoản (chỉ `admin`).
- `POST /api/users`: Tạo tài khoản cán bộ mới.
- `PATCH /api/users/:id/status`: Khóa / Mở khóa tài khoản.
- `POST /api/users/:id/reset-password`: Đặt lại mật khẩu tạm thời.

### 3.2. Nhóm Đợt mở KTX & Cổng nộp đơn công khai
- `GET /api/application-periods/active`: Lấy đợt tiếp nhận đang mở (Public).
- `POST /api/portal/apply-public`: Sinh viên nộp đơn đăng ký KTX công khai (đẩy vào BullMQ Queue).
- `GET /api/portal/application-result`: Tra cứu kết quả xét duyệt bằng MSSV + CCCD.
- `GET /api/application-periods`: Danh sách đợt (Cán bộ).
- `POST /api/application-periods`: Tạo đợt tiếp nhận mới (Manager).
- `GET /api/applications`: Danh sách đơn đăng ký theo đợt.
- `POST /api/applications/:id/review`: Duyệt hoặc từ chối đơn. Nếu duyệt: tự động gán giường nguyên tử, sinh tài khoản và đẩy job gửi Email vào hàng đợi.

### 3.3. Nhóm Cơ cấu không gian & Phòng/Giường
- `GET /api/campuses`: Danh sách 3 cơ sở (CS1, CS2, CS3).
- `GET /api/buildings?campusId=`: Danh sách tòa nhà theo cơ sở.
- `GET /api/rooms?buildingId=&floor=&roomType=`: Danh sách phòng (đọc qua Redis Cache).
- `GET /api/rooms/:id/beds`: Danh sách giường của phòng (kèm vị trí `lower`/`upper` và trạng thái).
- `PATCH /api/rooms/beds/:bedId/status`: Đổi trạng thái bảo trì giường.

### 3.4. Nhóm Hợp đồng & Check-in QR
- `GET /api/contracts`: Danh sách hợp đồng lưu trú.
- `GET /api/contracts/:id`: Chi tiết hợp đồng.
- `GET /api/portal/my-contracts`: Sinh viên xem hợp đồng của chính mình.
- `GET /api/portal/my-checkin-qr`: Sinh viên lấy mã QR Check-in nhận phòng.
- `POST /api/contracts/checkin-qr`: Cán bộ quét mã QR xác nhận bàn giao giường và kích hoạt hợp đồng (`active`).
- `POST /api/contracts/:id/terminate`: Chấm dứt hợp đồng trước hạn.

### 3.5. Nhóm Điện nước & Hóa đơn
- `POST /api/utilities/batch`: Nhập chỉ số đồng hồ điện nước theo lô (theo Tòa/Tầng).
- `GET /api/utilities/readings`: Tra cứu lịch sử chỉ số.
- `POST /api/invoices/generate-monthly`: Tự động tính toán tiền điện nước và sinh hóa đơn chia đều `Math.floor`.
- `GET /api/invoices`: Danh sách hóa đơn.
- `GET /api/portal/my-invoices`: Sinh viên xem hóa đơn của mình.
- `POST /api/invoices/:id/vietqr`: Sinh mã VietQR động NAPAS 247 cho hóa đơn.
- `POST /api/invoices/:id/manual-payment`: Ghi nhận thanh toán tiền mặt.

### 3.6. Nhóm Thanh toán & Webhook
- `POST /api/payments/create-vnpay-url`: Tạo URL thanh toán VNPay Sandbox.
- `GET /api/payments/vnpay-return`: Xử lý kết quả trả về từ VNPay.
- `POST /api/payments/vnpay-ipn`: Server-to-Server Webhook từ VNPay (xử lý Idempotent).

### 3.7. Nhóm Nghiệp vụ phát sinh (Chuyển phòng, Báo hỏng, Kỷ luật)
- `POST /api/requests/transfer`: Sinh viên nộp đơn xin chuyển phòng.
- `POST /api/requests/checkout`: Sinh viên nộp đơn xin trả phòng & hoàn cọc.
- `PATCH /api/requests/:id/review`: Duyệt / Từ chối đơn chuyển hoặc trả phòng.
- `POST /api/maintenance`: Sinh viên gửi yêu cầu báo hỏng cơ sở vật chất.
- `GET /api/maintenance`: Danh sách phiếu báo hỏng cần xử lý.
- `PATCH /api/maintenance/:id`: Phân công thợ sửa chữa và cập nhật chi phí.
- `POST /api/violations`: Cán bộ lập biên bản kỷ luật vi phạm nội quy.
- `GET /api/violations`: Xem danh sách vi phạm nội quy.

### 3.8. Nhóm Tương tác Smart KTX (Chat, Thông báo, Tin tức)
- `GET /api/chats/conversations`: Danh sách các cuộc trò chuyện của người dùng.
- `GET /api/chats/conversations/:id/messages`: Lịch sử tin nhắn trong phòng chat.
- `POST /api/chats/conversations/:id/messages`: Gửi tin nhắn mới (phát Socket.io event).
- `GET /api/announcements`: Bảng tin thông báo chung KTX.
- `POST /api/announcements`: Đăng thông báo mới (Cán bộ).
- `GET /api/notifications`: Danh sách chuông thông báo cá nhân.
- `PATCH /api/notifications/:id/read`: Đánh dấu thông báo đã đọc.

---

## 4. Kế hoạch kiểm thử & Tiêu chuẩn bàn giao (Definition of Done)

Mỗi module API được nghiệm thu bàn giao khi đáp ứng đầy đủ 4 tiêu chí sau:
1. **Đúng hợp đồng:** Khớp 100% path, method, status code, envelope `{ code, message, data }` định nghĩa trong `docs/API.md`.
2. **Chống IDOR tuyệt đối:** Mọi truy vấn phía Cổng sinh viên (`/portal/*`) trích xuất `studentId` từ JWT Token; cấm truyền qua URL query hay request body.
3. **Chống Race Condition:** Các thao tác chiếm giường, cập nhật trạng thái hóa đơn thanh toán phải dùng atomic condition update hoặc kiểm tra trạng thái Idempotent.
4. **Đầy đủ Unit/Integration Test:** Tối thiểu 1 test case cho luồng thành công và 2 test case cho các luồng bắt lỗi (Validation 400, Unauthorized 401, Forbidden 403, Conflict 409).
