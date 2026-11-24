# RESTful API Specification — HaUI - DMS (v2.7)

- **Base URL:** `http://localhost:5000/api`
- **Định dạng dữ liệu:** `application/json; charset=utf-8`
- **Xác thực:** Header `Authorization: Bearer <token>` (JWT hạn `7d`)

---

## 1. Quy Ước Chung (Conventions)

### 1.1. Envelope Phản Hồi Chuẩn
Mọi phản hồi thành công hoặc thất bại đều trả về cùng cấu trúc 3 trường:
```json
{
  "code": "OK",
  "message": "Thành công",
  "data": {}
}
```
Khi lỗi kiểm tra đầu vào (`400 VALIDATION_ERROR`), `data.errors` chứa danh sách lỗi theo từng trường để Frontend hiển thị dưới ô nhập:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ",
  "data": {
    "errors": [
      { "field": "citizenId", "message": "Số CCCD gồm đúng 12 chữ số" }
    ]
  }
}
```

### 1.2. Phân Trang Chuẩn (`paginate`)
Mọi endpoint danh sách có phân trang đều nhận `?page=1&limit=20` (`limit` tối đa `100`) và trả về:
```json
{
  "code": "OK",
  "message": "Thành công",
  "data": {
    "items": [],
    "total": 90,
    "page": 1,
    "limit": 20
  }
}
```
*(Một số danh sách quản trị đính kèm thêm đối tượng `summary` ngay bên trong `data`).*

### 1.3. Kiểu Dữ Liệu & Hằng Số Enum (`enums.js`)
- **Định danh:** Mọi `_id` của MongoDB được trả ra dưới tên trường `id` (`string`).
- **Ngày tháng (UTC+7):** Ngày không giờ là chuỗi `'YYYY-MM-DD'`; tháng chốt điện nước là `'YYYY-MM'`; dấu thời gian hệ thống (`createdAt`, `paidAt`, `reviewedAt`) là chuỗi ISO-8601.
- **Tiền tệ:** Số nguyên VND (`number >= 0`).
- **Bảng Enum chuẩn:**
  - `ROLES`: `'admin' | 'staff' | 'student'`
  - `GENDER`: `'male' | 'female'`
  - `STUDENT_STATUS`: `'active' | 'inactive'`
  - `ROOM_STATUS`: `'active' | 'maintenance'`
  - `ROOM_CAPACITY`: `4 | 6 | 8`
  - `BED_STATUS`: `'available' | 'occupied' | 'maintenance'`
  - `CONTRACT_TERMS`: `'6_months' | '12_months'`
  - `CONTRACT_STATUS_VIEW`: `'pending' | 'active' | 'expired' | 'terminated' | 'rejected'` *(trong DB không lưu `'expired'`, tự suy ra khi `active` quá `endDate`)*
  - `INVOICE_TYPE`: `'room_semester' | 'deposit' | 'utility'`
  - `INVOICE_SCOPE`: `'personal' | 'room'`
  - `INVOICE_STATUS`: `'unpaid' | 'paid'`
  - `PAYMENT_METHOD`: `'cash' | 'vietqr'`

### 1.4. Cưỡng Bức Đổi Mật Khẩu Lần Đầu (`mustChangePassword`)
Khi tài khoản có `mustChangePassword: true`, mọi request có gắn token sẽ bị chặn với `403 MUST_CHANGE_PASSWORD`, **ngoại trừ 3 endpoint**:
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `PATCH /api/auth/change-password`

---

## 2. Xác Thực & Quản Lý Tài Khoản (`/api/auth`, `/api/users`)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/health` | Công khai | Kiểm tra trạng thái hoạt động của máy chủ |
| `POST` | `/api/auth/login` | Công khai | Đăng nhập bằng Email hoặc MSSV |
| `POST` | `/api/auth/logout` | Đã đăng nhập | Đăng xuất phiên hiện tại |
| `GET` | `/api/auth/me` | Đã đăng nhập | Lấy thông tin tài khoản hiện tại (kèm hồ sơ `student` nếu là SV) |
| `PATCH` | `/api/auth/change-password` | Đã đăng nhập | Đổi mật khẩu cá nhân & tắt cờ `mustChangePassword` |
| `GET` | `/api/users` | `admin` | Danh sách tài khoản (`?role=&isActive=&search=&page=&limit=`) kèm `summary` |
| `POST` | `/api/users` | `admin` | Tạo tài khoản `admin` hoặc `staff` (trả `temporaryPassword` 10 ký tự) |
| `PUT` | `/api/users/:id` | `admin` | Cập nhật email, họ tên, vai trò (`admin` ↔ `staff`, chặn tự đổi mình hoặc admin cuối) |
| `PATCH` | `/api/users/:id/status` | `admin` | Khóa / mở khóa tài khoản `{ isActive: boolean }` |
| `POST` | `/api/users/:id/reset-password` | `admin`, `staff` | Đặt lại mật khẩu tạm (`staff` chỉ được reset cho `student`) |

- **`POST /api/auth/login`**
  - Body: `{ identifier: string, password: string }`
  - Response `data`: `{ token, expiresIn: 604800, user: { id, email, fullName, role, studentId, studentCode, mustChangePassword } }`
  - Lỗi: `401 INVALID_CREDENTIALS`, `403 ACCOUNT_LOCKED`.
- **`PATCH /api/auth/change-password`**
  - Body: `{ oldPassword: string, newPassword: string }` *(yêu cầu `>= 8` ký tự, có cả chữ và số, không trùng `studentCode`)*.
  - Lỗi: `400 INVALID_CURRENT_PASSWORD`, `400 PASSWORD_SAME_AS_DEFAULT`, `400 VALIDATION_ERROR`.

---

## 3. Quản Lý Hồ Sơ Sinh Viên (`/api/students`)
*Yêu cầu quyền: `admin`, `staff`.*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/students` | Danh sách SV (`?search=&gender=&faculty=&status=&hasAccount=&page=&limit=`). Mỗi phần tử kèm `userId`, `hasAccount`, `totalDebt`, `residence: { buildingCode, roomNumber, bedNumber }` |
| `GET` | `/api/students/:id` | Chi tiết SV kèm `currentContract`, `contracts[]`, `unpaidInvoices[]` |
| `POST` | `/api/students` | Thêm mới 1 hồ sơ SV (chưa tạo tài khoản đăng nhập) |
| `POST` | `/api/students/import` | Nhập hàng loạt từ dữ liệu Excel `{ rows: [{ row, ...studentFields }] }` (tối đa 1.000 dòng; trả `{ successCount, errorCount, errors }`) |
| `PUT` | `/api/students/:id` | Cập nhật hồ sơ SV (tự đồng bộ `studentCode`, `fullName` sang `User`; chặn đổi giới tính khi đang có đơn/hợp đồng) |
| `PATCH` | `/api/students/:id/deactivate` | Chuyển `status: 'inactive'` (chặn nếu còn đơn/hợp đồng `STUDENT_HAS_ACTIVE_CONTRACT` hoặc còn nợ `STUDENT_HAS_DEBT`) |

- **Các trường bắt buộc của Hồ sơ Sinh viên (`student.rules.js`):**
  `studentCode` (10 chữ số), `fullName`, `gender` (`'male'|'female'`), `dob` (`'YYYY-MM-DD'`), `phone` (`0xxxxxxxxx`), `email`, `citizenId` (12 chữ số), `address`, `faculty`, `className`, `emergencyContact: { name, phone, relationship }`.

---

## 4. Tòa Nhà & Phòng KTX (`/api/buildings`, `/api/rooms`)
*Yêu cầu quyền: `admin`, `staff`.*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/buildings` | Danh sách tòa nhà (`?includeInactive=true`) kèm `stats: { totalRooms, totalBeds, occupiedBeds, availableBeds, maintenanceBeds }` |
| `POST` | `/api/buildings` | Tạo tòa nhà `{ code, name, description? }` |
| `PUT` | `/api/buildings/:id` | Cập nhật `{ name?, description?, isActive? }` (chặn tắt hoạt động nếu còn người ở `422 BUILDING_HAS_OCCUPANTS`) |
| `GET` | `/api/rooms` | Danh sách phòng (`?buildingId=&floor=&gender=&capacity=&status=&availability=has_slot\|full&search=&page=&limit=`), sắp xếp tầng thấp → số phòng nhỏ |
| `GET` | `/api/rooms/:id` | Chi tiết phòng kèm mảng `beds: [{ bedNumber, bedCode, status, hasPendingApplication, occupant }]` |
| `POST` | `/api/rooms` | Tạo phòng `{ buildingId, roomNumber, floor, gender, capacity, pricePerMonth, depositAmount }` — tự sinh mảng giường `1..capacity` |
| `PUT` | `/api/rooms/:id` | Cập nhật phòng (chặn đổi `gender`/`capacity` khi có người ở `422 ROOM_HAS_OCCUPANTS` hoặc vướng đơn chờ `422 ROOM_HAS_PENDING_APPLICATIONS`) |

---

## 5. Cổng Tiếp Nhận Công Khai (`/api/public` & Đăng Ký Online)
*Không yêu cầu token xác thực.*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/public/rooms/available` | Tra cứu phòng còn giường trống theo giới tính `?gender=male\|female&buildingId=` (sắp xếp ngăn xếp tầng thấp → số phòng nhỏ, ẩn danh tính người đang ở, đánh dấu `hasPendingApplication`) |
| `POST` | `/api/contracts/register-online` | Nộp đơn đăng ký KTX trực tuyến `{ ...studentFields, roomId, bedNumber, term: '6_months' \| '12_months' }` → tạo/cập nhật `Student` và tạo `Contract` (`status: 'pending'`, chưa khóa giường) |
| `GET` | `/api/public/applications/status` | Tra cứu kết quả đơn đăng ký `?studentCode=&email=` |

---

## 6. Quản Lý Đơn Đăng Ký & Hợp Đồng (`/api/contracts`)
*Yêu cầu quyền: `admin`, `staff` (riêng `POST /register-online` công khai ở mục 5).*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/contracts` | Danh sách đơn & hợp đồng (`?status=pending,active...&buildingId=&roomId=&term=&isDepositRefunded=&search=&page=&limit=`) kèm `summary: { pending, active, expired, terminated, rejected, awaitingDepositRefund }` |
| `GET` | `/api/contracts/:id` | Chi tiết hợp đồng kèm `student` đầy đủ, `depositStatus`, `invoices[]` và dòng thời gian `history[]` |
| `PATCH` | `/api/contracts/:id/approve` | Phê duyệt đơn `{ roomId?, bedNumber? }`: khóa giường nguyên tử `$elemMatch`, chuyển `active`, tạo tài khoản `User` (`TK=MK=MSSV`, `mustChangePassword=true`), phát hành 2 hóa đơn (`deposit`, `room_semester`), gửi email thông báo |
| `PATCH` | `/api/contracts/:id/reject` | Từ chối đơn `{ reason: string }`: chuyển `rejected`, lưu lý do và gửi email thông báo cho SV |
| `PATCH` | `/api/contracts/:id/terminate` | Thanh lý hợp đồng & trả giường về `available` (chặn `422 OUTSTANDING_INVOICES` nếu còn hóa đơn cá nhân hoặc điện nước phòng chưa thanh toán) |
| `PATCH` | `/api/contracts/:id/deposit-refund` | Xác nhận đã hoàn trả đủ tiền cọc tại văn phòng sau thanh lý (`isDepositRefunded = true`, 1 lần duy nhất) |

---

## 7. Chỉ Số Điện Nước Bảng Lưới (`/api/utility-readings`)
*Yêu cầu quyền: `admin`, `staff`.*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/utility-readings/sheet` | Lấy bảng lưới nhập liệu theo tòa & tháng `?buildingId=&monthYear=YYYY-MM` (kèm `defaultUnitPrices`, chỉ số kỳ trước `previous` và số người đang ở `occupied`) |
| `POST` | `/api/utility-readings/bulk` | Lưu nháp hàng loạt `{ buildingId, monthYear, electricityUnitPrice, waterUnitPrice, rows: [{ roomId, electricityOldIndex, electricityNewIndex, waterOldIndex, waterNewIndex }] }` |
| `POST` | `/api/utility-readings/publish` | Chốt & phát hành hóa đơn điện nước cho toàn tòa `{ buildingId, monthYear }`: mỗi phòng có người ở sinh đúng **01 hóa đơn `scope: 'room'`**, khóa `isBilled = true` |
| `GET` | `/api/utility-readings/history` | Lịch sử chỉ số của 1 phòng `?roomId=&limit=12` |

---

## 8. Hóa Đơn & Thanh Toán (`/api/invoices`, `/api/payments`)
*Yêu cầu quyền: `admin`, `staff`.*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/invoices` | Danh sách hóa đơn (`?status=&type=&scope=&buildingId=&search=&page=&limit=`) kèm `summary: { totalAmount, paidAmount, unpaidAmount, unpaidCount }` |
| `GET` | `/api/invoices/:id` | Chi tiết hóa đơn kèm `payments[]`; nếu `type === 'utility'` kèm thêm `reading` và danh sách `members[]` đang ở phòng |
| `GET` | `/api/payments` | Danh sách biên lai phiếu thu (`?method=&type=&from=YYYY-MM-DD&to=YYYY-MM-DD&search=&invoiceId=&page=&limit=`) kèm `summary: { totalAmount, cashAmount, vietqrAmount }` |
| `POST` | `/api/payments/cash` | Thu tiền mặt tại quầy `{ invoiceId, payerStudentId?, note? }` *(hóa đơn `scope: 'room'` bắt buộc truyền `payerStudentId` thuộc phòng đó)* |
| `POST` | `/api/payments/vietqr/confirm` | Đối soát & xác nhận chuyển khoản VietQR `{ invoiceId, payerStudentId?, transactionCode?, note? }` *(chặn trùng `transactionCode` với `409 DUPLICATE_TRANSACTION_CODE`)* |

---

## 9. Cổng Dịch Vụ Sinh Viên (`/api/portal`)
*Yêu cầu quyền: `student` (danh tính luôn lấy từ `req.user.studentId`).*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/portal/profile` | Hồ sơ cá nhân của sinh viên đang đăng nhập |
| `GET` | `/api/portal/my-residence` | Thông tin chỗ ở hiện tại (`hasResidence`, `contract`, `roommates: [{ studentCode, fullName }]`, `debtSummary`) |
| `GET` | `/api/portal/my-contracts` | Toàn bộ lịch sử đơn đăng ký & hợp đồng của sinh viên |
| `GET` | `/api/portal/my-invoices` | Danh sách hóa đơn cá nhân + hóa đơn điện nước của phòng đang ở (`?scope=personal\|room&status=&page=&limit=`) |
| `GET` | `/api/portal/my-invoices/:id` | Chi tiết 1 hóa đơn (kiểm tra quyền sở hữu / cùng phòng) |
| `GET` | `/api/portal/my-invoices/:id/vietqr` | Sinh thông số mã VietQR động chuẩn NAPAS `{ bankBin, accountNumber, accountName, amount, transferContent }` |
| `GET` | `/api/portal/my-payments` | Lịch sử các phiếu thu liên quan tới hóa đơn cá nhân & phòng đang ở |
| `GET` | `/api/portal/my-room/utility-history` | Lịch sử chỉ số điện nước các tháng đã chốt của phòng đang ở (`?limit=12`) |

---

## 10. Dashboard & Thống Kê (`/api/dashboard`)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | `admin`, `staff` | Tổng quan KPI: `occupancy: { total, occupied, available, maintenance }`, `activeStudents`, `pendingApplications`, `finance: { totalDebt, roomDebt, utilityDebt }` *(không tính tiền cọc vào công nợ doanh thu)* |
| `GET` | `/api/dashboard/occupancy` | `admin`, `staff` | Tỷ lệ lấp đầy chi tiết theo từng tòa nhà đang hoạt động |
| `GET` | `/api/dashboard/revenue` | `admin` | Doanh thu thực thu theo từng tháng trong năm `?year=YYYY` (`[{ month, roomRevenue, utilityRevenue, total }]`, loại trừ tiền cọc) |
