# RESTful API Specification — HaUI - DMS (v3.0)

- **Base URL:** `http://localhost:5000/api`
- **Envelope chuẩn:** `{ code: "OK" | "<ERROR_CODE>", message: string, data: any }`
- **Phân trang chuẩn:** `data: { items, total, page, limit, summary? }` (`limit <= 100`)
- **Xác thực:** `Authorization: Bearer <jwt_7d>` (4 vai trò: `admin`, `manager`, `staff`, `student`)

---

## 1. Trang Chủ Công Khai & Tiếp Nhận Đơn (`/api/public`, không cần token)

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/health` | Kiểm tra tình trạng server |
| `GET` | `/api/public/campuses` | Thông tin 3 cơ sở (địa chỉ 2026), danh sách tòa nhà & **Bảng giá phòng chính thức 2026–2027** |
| `GET` | `/api/public/announcements` | Tin tức & Thông báo mở đợt công khai trên trang chủ KTX (`?campus=&limit=`) |
| `GET` | `/api/public/periods/open` | Danh sách các Đợt đăng ký đang mở (`?studentCode=&faculty=` → tự phân luồng `freshman` vs `returning` từ 4 số đầu MSSV và gắn cờ `eligible` + lý do) |
| `GET` | `/api/public/rooms/available` | Phòng còn chỗ trống lọc theo `?periodId=&campus=&buildingId=&gender=&roomTier=&capacity=&maxFloor=` (sắp xếp tầng thấp → phòng nhỏ) |
| `POST` | `/api/contracts/register-online` | Nộp đơn trực tuyến trong Đợt đang mở `{ periodId, ...studentFields, roomId?, preferredRoomTier?, preferredCapacity?, term }`. Nếu MSSV đã tồn tại, bắt buộc khớp `citizenId`. |
| `GET` | `/api/public/applications/status` | Tra cứu tiến độ đơn `?studentCode=&email=` |
| `POST` | `/api/public/applications/cancel` | Sinh viên tự hủy đơn khi đang `pending` `{ studentCode, email, citizenId, reason? }` |

---

## 2. Xác Thực & Quản Lý Tài Khoản (`/api/auth`, `/api/users`)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `POST` | `/api/auth/login` | Công khai | Đăng nhập bằng Email hoặc MSSV (`{ identifier, password }`) |
| `POST` | `/api/auth/logout` | Đã đăng nhập | Đăng xuất |
| `GET` | `/api/auth/me` | Đã đăng nhập | Thông tin tài khoản (kèm `student` & `unreadNotifications` nếu là SV) |
| `PATCH` | `/api/auth/change-password` | Đã đăng nhập | Đổi mật khẩu & tắt cờ `mustChangePassword` |
| `GET` | `/api/users` | `admin` | Danh sách tài khoản (`?role=&isActive=&search=&page=&limit=`) |
| `POST` | `/api/users` | `admin` | Tạo tài khoản `admin`, `manager` hoặc `staff` |
| `PUT` | `/api/users/:id` | `admin` | Cập nhật email, họ tên, vai trò (`admin \| manager \| staff`) |
| `PATCH` | `/api/users/:id/status` | `admin` | Khóa / mở khóa tài khoản |
| `POST` | `/api/users/:id/reset-password` | `admin`, `manager`, `staff` | Đặt lại mật khẩu tạm (`manager`/`staff` chỉ được reset cho `student`) |

---

## 3. Quản Lý Hồ Sơ Sinh Viên (`/api/students`)
*Quyền: `manager`, `staff`.*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/students` | Danh sách SV (`?search=&gender=&faculty=&priorityType=&enrollmentYear=&status=&hasAccount=`) |
| `GET` | `/api/students/:id` | Chi tiết SV kèm hợp đồng, công nợ, diện ưu tiên, tình trạng sức khỏe |
| `POST` | `/api/students` | Thêm 1 hồ sơ SV (tự trích `enrollmentYear` từ MSSV) |
| `POST` | `/api/students/import` | Nhập hàng loạt từ Excel `{ rows: [...] }` (tối đa 1.000 dòng) |
| `PUT` | `/api/students/:id` | Cập nhật hồ sơ SV (đồng bộ `User.studentCode` & `fullName`) |
| `PATCH` | `/api/students/:id/deactivate` | Vô hiệu hóa hồ sơ (chặn nếu còn đơn/hợp đồng hoặc nợ) |

---

## 4. Cơ Sở Vật Chất 3 Cơ Sở (`/api/buildings`, `/api/rooms`)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/buildings` | `manager`, `staff` | Danh sách tòa nhà (`?campus=cs1\|cs2\|cs3&includeInactive=true`) kèm thống kê phòng & chỗ ở (`totalCapacity`, `occupiedSlots`, `availableSlots`) |
| `POST` | `/api/buildings` | `manager` | Tạo tòa nhà `{ campus, code, name, totalFloors?, description? }` |
| `PUT` | `/api/buildings/:id` | `manager` | Cập nhật tòa (chặn tắt nếu còn người ở hoặc đơn `pending`/`pending_payment`) |
| `GET` | `/api/rooms` | `manager`, `staff` | Danh sách phòng (`?campus=&buildingId=&floor=&gender=&roomTier=&capacity=&status=&availability=&search=`) kèm `occupiedCount`, `availableSlots`, `pendingCount` |
| `GET` | `/api/rooms/:id` | `manager`, `staff` | Chi tiết phòng kèm danh sách `occupants[]` (các SV đang `active`/`pending_payment` trong phòng) và số đơn `pending` |
| `POST` | `/api/rooms` | `manager` | Tạo phòng `{ buildingId, roomNumber, floor, gender, roomTier, capacity, hasAirConditioner?, hasWaterHeater?, amenities?, pricePerMonth, depositAmount }` |
| `PUT` | `/api/rooms/:id` | `manager` | Cập nhật phòng (chặn đổi giới tính khi có người ở/đơn chờ; chặn hạ `capacity` dưới `occupiedCount`) |

---

## 5. Quản Lý Đợt Đăng Ký (`/api/periods`)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/periods` | `manager`, `staff` | Danh sách đợt đăng ký (`?campus=&status=&academicYearStart=`) kèm số đơn theo trạng thái |
| `GET` | `/api/periods/:id` | `manager`, `staff` | Chi tiết 1 đợt đăng ký |
| `POST` | `/api/periods` | `manager` | Tạo đợt đăng ký mới `{ code, name, academicYearStart, campus, targetCohort, allowedFaculties?, excludedFaculties?, allowedTerms, startDate, endDate, paymentDeadlineDays?, status?, description? }` |
| `PUT` | `/api/periods/:id` | `manager` | Cập nhật cấu hình đợt |
| `PATCH` | `/api/periods/:id/status` | `manager` | Đóng/mở nhanh đợt `{ status: 'upcoming' \| 'open' \| 'closed' }` |

---

## 6. Xét Duyệt, Chờ Đóng Phí, QR Check-in & Hoàn Cọc (`/api/contracts`)
*Quyền: `manager`, `staff`.*

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/contracts` | Danh sách đơn & hợp đồng (`?status=&periodId=&campus=&buildingId=&roomId=&term=&isDepositRefunded=&overduePayment=true&search=`) kèm `summary` |
| `GET` | `/api/contracts/:id` | Chi tiết hợp đồng kèm hồ sơ SV, hóa đơn, trạng thái Check-in QR, thông tin khấu trừ cọc & dòng thời gian `history[]` |
| `PATCH` | `/api/contracts/:id/approve` | Duyệt 1 đơn `{ roomId? }` → Khóa 1 chỗ nguyên tử trong phòng (`occupiedCount < capacity`), chuyển `pending_payment` (hạn 7 ngày), cấp TK + Email + Thông báo + hóa đơn đầu kỳ |
| `POST` | `/api/contracts/auto-approve` | **Tự động duyệt & xếp phòng nhân văn theo lô** `{ periodId?, limit? }`: sắp xếp ưu tiên (`policy_family > poor_household > remote_area > normal`), ưu tiên phòng tầng thấp (`floor <= 2`) cho SV có vấn đề thể chất |
| `PATCH` | `/api/contracts/:id/reject` | Từ chối đơn `pending` `{ reason }` + gửi Email thông báo |
| `PATCH` | `/api/contracts/:id/cancel` | Hủy hợp đồng `pending_payment` `{ reason? }` (chưa thanh toán) → hủy hóa đơn nháp sang `cancelled` + nhả 1 chỗ phòng ngay |
| `POST` | `/api/contracts/cancel-overdue` | Hủy hàng loạt toàn bộ hợp đồng `pending_payment` đã quá `paymentDeadline` chưa đóng phí → thu hồi chỗ phòng cho đợt bổ sung |
| `POST` | `/api/contracts/checkin-qr` | **Quét mã QR Check-in nhận phòng** `{ checkinCode }` → xác thực hợp đồng `active` & ghi nhận `checkedInAt` |
| `PATCH` | `/api/contracts/:id/terminate` | Thanh lý hợp đồng `active`/`expired` khi sạch nợ 100% → nhả 1 chỗ phòng |
| `PATCH` | `/api/contracts/:id/deposit-refund` | Quyết toán hoàn cọc `{ deductionAmount?: number, reason?: string }` → hoàn `depositAmount - deductionAmount`, lưu phiếu chi `Payment` loại `refund` |

---

## 7. Điện Nước, Hóa Đơn & Webhook VietQR Tự Động (`/api/utility-readings`, `/api/invoices`, `/api/payments`)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/utility-readings/sheet` | `manager`, `staff` | Bảng lưới điện nước theo tòa & tháng `?buildingId=&monthYear=` |
| `POST` | `/api/utility-readings/bulk` | `manager`, `staff` | Lưu hàng loạt (kiểm tra `oldIndex === previous.newIndex` trừ khi `allowMeterReset: true`) |
| `POST` | `/api/utility-readings/publish` | `manager`, `staff` | Phát hành 01 hóa đơn phòng (`scope: 'room'`) + **bắn Thông báo In-app & Email** tới tất cả SV trong phòng |
| `GET` | `/api/utility-readings/history` | `manager`, `staff` | Lịch sử điện nước 1 phòng `?roomId=&limit=12` |
| `GET` | `/api/invoices` | `manager`, `staff` | Danh sách hóa đơn (`?status=&type=&scope=&campus=&buildingId=&search=`) kèm `summary` |
| `GET` | `/api/invoices/:id` | `manager`, `staff` | Chi tiết hóa đơn kèm phiếu thu, chỉ số điện nước & danh sách thành viên phòng |
| `GET` | `/api/payments` | `manager`, `staff` | Danh sách phiếu thu & phiếu chi hoàn cọc (`?paymentType=&method=&type=&from=&to=&search=`) |
| `POST` | `/api/payments/cash` | `manager`, `staff` | Thu tiền mặt tại quầy `{ invoiceId, payerStudentId?, note? }` *(tự nâng `pending_payment -> active` nếu đủ phí đầu kỳ)* |
| `POST` | `/api/payments/vietqr/confirm` | `manager`, `staff` | Đối soát thủ công dự phòng `{ invoiceId, payerStudentId?, transactionCode?, note? }` |
| `POST` | `/api/payments/webhook/vietqr` | **Webhook Secret** | **Tự động gạch nợ VietQR chuẩn SePay/Casso** `{ content, transferAmount, referenceCode, payerStudentId? }` (header `x-webhook-secret`) — chống trùng idempotent, tự kích hoạt hợp đồng & sinh QR Check-in |
| `POST` | `/api/payments/webhook/simulate` | `manager`, `staff` | **Giả lập ngân hàng báo có** `{ invoiceId, payerStudentId? }` phục vụ demo/kiểm thử |

---

## 8. Phiếu Yêu Cầu SV (`/api/requests`) & Bảng Tin (`/api/notifications`)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/requests` | `manager`, `staff` | Danh sách phiếu yêu cầu (`?type=repair\|transfer\|checkout&status=&campus=&search=`) kèm `summary` |
| `PATCH` | `/api/requests/:id/status` | `manager`, `staff` | Cập nhật trạng thái phiếu `{ status, handlerNote?, targetRoomId? }`. *Riêng duyệt chuyển phòng (`transfer` → `approved`/`completed`) chỉ `manager` và tự khóa chỗ phòng mới + nhả chỗ phòng cũ nguyên tử!* |
| `GET` | `/api/notifications/announcements` | `manager`, `staff` | Danh sách bảng tin KTX đã đăng |
| `POST` | `/api/notifications/announcements` | `manager`, `staff` | Đăng bảng tin mới `{ title, content, campus?: 'all'\|'cs1'\|'cs2'\|'cs3' }` |
| `DELETE` | `/api/notifications/announcements/:id` | `manager` | Xóa bảng tin |

---

## 9. Cổng Dịch Vụ Sinh Viên (`/api/portal`, Quyền: `student`)

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/portal/profile` | Hồ sơ cá nhân SV |
| `GET` | `/api/portal/my-residence` | Chỗ ở hiện tại (gồm cả `pending_payment` & `active`), bạn cùng phòng, công nợ & `unreadNotifications` |
| `GET` | `/api/portal/my-contracts` | Lịch sử đơn & hợp đồng của tôi |
| `POST` | `/api/portal/applications` | **Đăng ký / Gia hạn KTX nội bộ** (dành cho SV năm 2+ đã có tài khoản — không cần gõ lại hồ sơ!) `{ periodId, roomId?, preferredRoomTier?, preferredCapacity?, term }` |
| `GET` | `/api/portal/my-contracts/:id/checkin-qr` | Lấy **Mã QR Check-in** bàn giao phòng (khi hợp đồng đã `active`) |
| `GET` | `/api/portal/my-invoices` | Hóa đơn cá nhân + hóa đơn điện nước phòng đang ở |
| `GET` | `/api/portal/my-invoices/:id` | Chi tiết hóa đơn |
| `GET` | `/api/portal/my-invoices/:id/vietqr` | Sinh mã VietQR động chuẩn NAPAS `{ bankBin, accountNumber, accountName, amount, transferContent, qrImageUrl }` |
| `GET` | `/api/portal/my-payments` | Lịch sử thanh toán & phiếu hoàn cọc của tôi |
| `GET` | `/api/portal/my-room/utility-history` | Lịch sử điện nước các tháng đã chốt của phòng |
| `GET` | `/api/portal/requests` | Danh sách phiếu Báo hỏng / Chuyển phòng / Trả phòng đã gửi |
| `POST` | `/api/portal/requests` | Gửi phiếu mới `{ type: 'repair'\|'transfer'\|'checkout', title, description, repairCategory?, targetRoomId?, attachmentUrl? }` |
| `PATCH` | `/api/portal/requests/:id/cancel` | SV tự hủy phiếu khi đang `pending` |
| `GET` | `/api/portal/notifications` | Chuông thông báo cá nhân + Bảng tin KTX (kèm `unreadCount`) |
| `PATCH` | `/api/portal/notifications/:id/read` | Đánh dấu 1 thông báo đã đọc |
| `PATCH` | `/api/portal/notifications/read-all` | Đánh dấu tất cả thông báo cá nhân đã đọc |

---

## 10. Dashboard & Báo Cáo 3 Cơ Sở (`/api/dashboard`)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | `manager`, `staff` | KPI tổng quan (hỗ trợ `?campus=cs1\|cs2\|cs3`): lấp đầy, SV đang ở, đơn chờ duyệt, đơn chờ đóng phí, phiếu yêu cầu chờ xử lý, công nợ |
| `GET` | `/api/dashboard/occupancy` | `manager`, `staff` | Tỷ lệ lấp đầy chi tiết theo từng Tòa nhà & gom nhóm theo **3 Cơ sở** |
| `GET` | `/api/dashboard/revenue` | **`manager`** *(chỉ Manager!)* | Doanh thu thực thu theo tháng trong năm (`?year=2026&campus=`), tách tiền phòng & điện nước, loại trừ tiền cọc và phiếu chi hoàn cọc |
