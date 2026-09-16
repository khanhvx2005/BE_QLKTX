# 16 – YÊU CẦU API TỪ FRONTEND GỬI BACKEND

**Hệ thống:** DMS – Hệ thống quản lý ký túc xá
**Người đọc:** nhóm Backend (3 người)
**Người lập:** FE Lead · **Ngày:** 15/09/2026
**Đối chiếu:** `docs/API.md` **v1.2.8** ↔ repo `BE_QLKTX` commit `ab7db8c` (first-commit). Trích dẫn `file:dòng` trỏ vào `BE_QLKTX/src`.

> **Tóm tắt một dòng:** backend đang làm theo API **v1.1** (xếp giường bằng tay). Frontend đã làm xong 16/31 màn theo **v1.2** (đăng ký theo phòng, giường tự gán, nhu yếu phẩm). Để nối được, backend cần: **thêm 5 nhóm API còn thiếu**, **sửa định dạng/luật ở 7 nhóm đang lệch**, **bỏ 8 API thừa của v1.1**, và **sửa 6 lỗi chung**.

---

## 0. Cách đọc

| Ký hiệu | Nghĩa |
|---|---|
| ✅ | Có và khớp — FE dùng được ngay |
| ⚠️ | Có nhưng lệch (tên trường, định dạng, luật, mã lỗi) — cần sửa |
| ❌ | Chưa có — cần làm |
| 🗑️ | Thừa so với v1.2 — nên bỏ |

| Ưu tiên | Nghĩa |
|---|---|
| **P0** | Chặn màn FE **đã xong** — cần sớm nhất để nối |
| **P1** | Cho màn FE **sắp làm** (tài chính, thanh toán, nhu yếu phẩm, cổng SV còn lại) |
| **P2** | Dọn dẹp, bảo mật, lỗi tiềm ẩn — không chặn giao diện |

- **Nguồn sự thật** là `docs/API.md` (định dạng request/response, mã lỗi mục 13) và `docs/DATA-SCHEMA.md` (tên trường). Tài liệu này **không lặp lại** định dạng đã có ở `API.md`, chỉ chỉ ra chỗ lệch và việc cần làm.
- Mọi phần FE bổ sung vào `API.md` nằm ở bảng **Change Log** cuối file, bản **1.2.1 → 1.2.8**.
- Frontend có lớp dữ liệu giả (`src/mocks/`) trả **đúng** định dạng trong `API.md` — khi phân vân, chạy FE ở chế độ dữ liệu giả (`VITE_USE_MOCK=true`), mở F12 → Network để xem request/response mẫu.

---

## 1. Bảng tổng hợp

| # | Nhóm API | Màn FE dùng | Trạng thái | Ưu tiên |
|---|---|---|---|---|
| 1 | Auth (`/auth/*`) | SCR-01, 02, 03 | ⚠️ gần khớp | P0 |
| 2 | Tài khoản (`/users`) | SCR-81 | ❌ chỉ có reset mật khẩu | P0 |
| 3 | Sinh viên (`/students`) | SCR-11, 31, 81 | ⚠️ thiếu trường | P0 |
| 4 | Tòa nhà (`/buildings`) | SCR-21, 23 | ⚠️ | P0 |
| 5 | **Loại phòng (`/room-types`)** | SCR-22, 23, 62, 10 | ❌ | **P0** |
| 6 | Phòng & giường (`/rooms`, `/beds`) | SCR-23, 31, 62 | ⚠️ lệch mô hình v1.1 | **P0** |
| 7 | **Đơn đăng ký (`/applications`)** | SCR-31 | ❌ | **P0** |
| 8 | Hợp đồng (`/contracts`) | SCR-32, 61 | ⚠️ lệch nhiều | P0 |
| 9 | Yêu cầu gia hạn/trả phòng (`/requests`) | SCR-41, 66 | ⚠️ thiếu quyết toán đầy đủ | P0 |
| 10 | **Cổng sinh viên (`/portal/*`)** | SCR-61, 62, 63→69 | ❌ chỉ có `my-requests` | **P0** / P1 |
| 11 | Dashboard (`/dashboard`) | SCR-10 | ⚠️ định dạng khác | P0 |
| 12 | Phí, chỉ số, hóa đơn (`/fee-types`, `/utility-readings`, `/invoices`) | SCR-51→55, 82 | ⚠️ lệch tên trường | P1 |
| 13 | Thanh toán (`/payments`) | SCR-54→56, 64, 65 | ⚠️ | P1 |
| 14 | **Nhu yếu phẩm (`/supply-items`, `/supply-orders`)** | SCR-67, 68, 71 | ❌ | P1 |
| 15 | Lưu trú (`/residencies`) | — (không có màn riêng) | 🗑️ phần tạo tay | P2 |

---

## 2. Lỗi chung — sửa trước vì ảnh hưởng mọi module (P0/P2)

| # | Vấn đề | Hậu quả | Đề xuất | Trích dẫn |
|---|---|---|---|---|
| G1 | **Express 5: `req.query` chỉ đọc** — middleware `validate` gán `req.query = value` không có tác dụng | Giá trị mặc định/ép kiểu của Joi cho query bị bỏ; `GET /contracts/expiring` **luôn trả danh sách không lọc** vì gán `req.query.expiringInDays` bị mất | Lưu kết quả vào `req.validatedQuery` (hoặc `res.locals`) và service đọc từ đó | `core/middlewares/validate.js:46`, `contract.routes.js:25-28` |
| G2 | **`allowUnknown: true, stripUnknown: false`** + service `Object.assign(doc, data)` | Client gửi thêm trường ngoài schema vẫn được ghi (VD `status` của hợp đồng, `gender` của phòng) — lỗ hổng mass-assignment | `stripUnknown: true` hoặc service chỉ lấy trường cho phép | `validate.js:23-27`; `student.service.js:139`, `room.service.js:176`, `contract.service.js:165`, `fee.service.js:42` |
| G3 | `authenticate` **không kiểm tra lại `isActive`** của user | Tài khoản bị khóa vẫn dùng token cũ **tới 7 ngày** | Tra `User` theo `id` trong token (có thể cache ngắn) và trả `403 ACCOUNT_LOCKED` | `core/middlewares/auth.js:15-43` |
| G4 | **Không giới hạn tần suất** `/auth/login` | Vi phạm **FR-05** (chống dò mật khẩu) | `express-rate-limit` cho `/api/auth/login` | — |
| G5 | **Tên mã lỗi khác `API.md` mục 13** | FE bắt lỗi theo mã → không nhận ra | Đổi đúng tên: `BED_IS_OCCUPIED` → `BED_OCCUPIED` · `INVOICE_HAS_PAYMENTS` → `INVOICE_HAS_PAYMENT` · `AMOUNT_EXCEEDS_DEBT` → `PAYMENT_EXCEEDS_REMAINING` · `INVALID_SIGNATURE` → `GATEWAY_SIGNATURE_INVALID` · `BUILDING_CODE_ALREADY_EXISTS`, `ROOM_NUMBER_ALREADY_EXISTS`, `FEE_TYPE_CODE_ALREADY_EXISTS`, `STUDENT_CODE_ALREADY_EXISTS`, `EMAIL_ALREADY_EXISTS` → `DUPLICATE_ENTRY` **kèm** `data.errors[{field,message}]` · `INVALID_END_DATE` → `VALIDATION_ERROR` có field | `shared/constants/error-codes.js` và các service |
| G6 | **Luật mật khẩu** min 6, không regex | Lệch **BR-81** (≥ 8 ký tự, có chữ và số) — FE đang chặn 8 ký tự | Sửa Joi ở `register`, `change-password` | `auth.validation.js:8-71` |

Những điểm **đã khớp** (giữ nguyên): envelope `{ code, message, data }`; lỗi Joi `400 VALIDATION_ERROR` với `data.errors[{field,message}]`; phân trang `{ items, total, page, limit }`; `_id` → `id`; CORS mặc định `http://localhost:5173`; JWT 7 ngày không refresh token.

---

## 3. Chi tiết theo module

### 3.1. Auth — P0

| Endpoint | Trạng thái | Cần làm |
|---|---|---|
| `POST /auth/login` | ✅ | Đúng định dạng, đúng `INVALID_CREDENTIALS` 401 / `ACCOUNT_LOCKED` 403. Chỉ còn G3, G4 |
| `POST /auth/register` | ✅ | Đã tạo cả `Student` + `User`. Sửa mã lỗi trùng (G5) và luật mật khẩu (G6) |
| `GET /auth/me`, `POST /auth/logout` | ✅ | — |
| `PATCH /auth/change-password` | ✅ | Body `{ oldPassword, newPassword }` khớp. G6 |
| `POST /users/:id/reset-password` | ⚠️ | Mật khẩu tạm đang là **10 ký tự hex** — BR-85 cần có cả chữ và số (hex có thể toàn số). Thêm `422 CANNOT_MODIFY_SELF` khi tự reset mình. Bỏ bản trùng `/api/auth/users/:id/reset-password` (`auth.routes.js:30`) |

### 3.2. Tài khoản `/users` — P0 ❌ (màn SCR-81 đã xong)

Làm theo **`API.md` mục 2.1** (bản 1.2.6) — việc **T3.16** trong `09-KE-HOACH-PHAN-CONG`:

| Endpoint | Ghi chú chính |
|---|---|
| `GET /users?search=&role=&isActive=&page=&limit=` | Chỉ admin. Item có `student: { id, studentCode, fullName }` khi role student. Kèm `summary: { all, admin, staff, viewer, student, locked }` |
| `POST /users` `{ email, fullName, role, studentId? }` | Sinh **mật khẩu tạm** (BR-85), `mustChangePassword: true`, trả `{ user, temporaryPassword }` một lần. Role `student` bắt buộc `studentId` chưa có tài khoản (BR-82) |
| `PUT /users/:id` `{ email, fullName, role }` | Không đổi vai trò giữa student ↔ cán bộ; không tự đổi vai trò mình (`422 CANNOT_MODIFY_SELF`); không hạ quyền admin cuối (`422 LAST_ACTIVE_ADMIN`, BR-83) |
| `PATCH /users/:id/status` `{ isActive }` | Không tự khóa mình; không khóa admin cuối |

### 3.3. Sinh viên — P0 ⚠️

| Endpoint | Lệch | Cần làm |
|---|---|---|
| `GET /students` | Item thiếu `residence` và `totalDebt` (màn SCR-11 hiện cột **Chỗ ở** và **Công nợ**); thiếu `hasAccount` (SCR-81 tạo tài khoản sinh viên); không lọc `faculty` | Thêm `residence: { bedCode, buildingName, roomNumber, endDate } \| null`, `totalDebt`, `hasAccount` (= có `userId`); hỗ trợ `?faculty=` |
| `GET /students/:id` | ✅ có `currentResidency`, `outstandingDebt` | — |
| `POST`, `PUT`, `PATCH /:id/deactivate` | ✅ | Deactivate: bỏ kiểm tra hợp đồng `pending` (v1.2 không còn trạng thái này). G5 cho mã trùng |

### 3.4. Tòa nhà — P0 ⚠️

Chi tiết ở **`API.md` mục 4** (bản 1.2.7).

| Lệch | Cần làm | Trích dẫn |
|---|---|---|
| `GET /buildings` luôn chỉ trả tòa đang hoạt động → **tòa đã ngừng không bao giờ kích hoạt lại được** từ giao diện | Nhận `?includeInactive=true` (admin, staff, viewer) | `room.service.js:15-42` |
| `stats` thiếu `maintenanceBeds` | Thêm — FE tính tỷ lệ lấp đầy = đã ở / (tổng − bảo trì) | idem |
| Cho ngừng hoạt động tòa còn người ở | `422 BUILDING_HAS_OCCUPANTS` (FR-25) | `room.service.js:58-67` |
| Mã trùng trả `BUILDING_CODE_ALREADY_EXISTS` | `409 DUPLICATE_ENTRY` + field `code` (G5) | `room.service.js:47` |

### 3.5. Loại phòng `/room-types` — P0 ❌

Chưa có model lẫn route. Làm theo **`API.md` mục 4** + **`DATA-SCHEMA` 3.4a** (`tier`, `capacity`, `name`, `pricePerMonth`, `depositAmount`, `amenities`, `isActive`):

- `GET /room-types?tier=&isActive=&withAvailability=true` — với `withAvailability` thêm `roomCount`, `availableSlots` (**số giường `available`**, BR-05); với sinh viên chỉ đếm phòng **đúng giới tính** của họ. Kèm `includedSupplies` (tên nhu yếu phẩm cấp sẵn).
- `POST /room-types` (admin) · `PUT /room-types/:id` (admin) — khóa `tier`/`capacity` khi đã có phòng dùng: `422 ROOM_TYPE_IN_USE` (BR-09).
- Seed tối thiểu 6 loại: Tiêu chuẩn 8/6/4 người, Chất lượng cao 6/4/3 người.

### 3.6. Phòng & giường — P0 ⚠️ (lệch mô hình)

**Mô hình phải đổi (v1.2, `DATA-SCHEMA` 3.4–3.5):** phòng **thuộc một loại phòng**, giá lấy từ loại phòng, **giường tự sinh** khi tạo phòng, không thêm/xóa giường bằng tay, người không bao giờ chọn giường.

| Endpoint | Hiện tại | Cần làm |
|---|---|---|
| `POST /rooms` | Nhận `capacity`, `pricePerBed`; **không sinh giường** | Body `{ buildingId, roomNumber, floor, roomTypeId, gender, status? }`. `capacity` chép từ loại phòng. **Tự sinh `capacity` giường** (`B203-01`…). Bỏ `pricePerBed`. Trùng số phòng → `409 DUPLICATE_ENTRY` field `roomNumber` |
| `PUT /rooms/:id` | Chỉ `pricePerBed`, `capacity`, `status` | `{ roomNumber, floor, roomTypeId, gender, status }`. Đổi `roomTypeId`/`gender` hoặc chuyển `inactive` khi còn người → `422 ROOM_HAS_OCCUPANTS` (BR-09). Đổi loại lúc trống → sinh lại giường |
| `GET /rooms` | Item có `pricePerBed`, `totalBeds`, `availableBeds`, `occupiedBeds`; phân trang trong bộ nhớ (`room.service.js:83-118`) | Item: `buildingId`, `buildingCode`, `buildingName`, `roomNumber`, `floor`, `roomTypeId`, `roomTypeName`, `tier`, `pricePerMonth`, `gender`, `capacity`, `occupied`, `availableSlots`, `maintenanceBeds`, `status`. Lọc `?buildingId=&roomTypeId=&floor=&gender=&availability=has_slot\|full\|has_maintenance`. Phân trang ở Mongo |
| `GET /rooms/:id` | `beds` **không có người ở** | Như `API.md` ví dụ `GET /api/rooms/:id`: mỗi giường có `occupant: { studentCode, studentName, className } \| null` và `note`; thêm `amenities`, `includedSupplies`, `pricePerMonth` |
| `GET /rooms/available` | ❌ | `?roomTypeId=&buildingId=&gender=` — phòng `active` còn ≥ 1 giường `available`. Sinh viên: giới tính lấy từ JWT, bỏ qua tham số `gender` |
| `PATCH /beds/:id/status` | Không nhận `note`; mã lỗi `BED_IS_OCCUPIED` | Body `{ status, note? }` — lưu `note` khi `maintenance`, xóa khi mở lại. Mã `422 BED_OCCUPIED` |
| `GET /rooms/:roomId/beds`, `POST /rooms/:roomId/beds`, `POST /rooms/:roomId/beds/generate` | 🗑️ | **Bỏ** (v1.2 không cho thêm giường bằng tay; danh sách giường nằm trong `GET /rooms/:id`) |

### 3.7. Đơn đăng ký `/applications` — P0 ❌ (màn SCR-31, SCR-62 đã xong)

Làm theo **`API.md` mục 5.1** + **`03` BR-33 → BR-38**, **mục 4.1** (gán giường nguyên tử):

- `GET /applications?status=&roomTypeId=&search=&page=&limit=` — chờ duyệt: cũ nhất lên đầu; đã xử lý: xử lý gần nhất lên đầu; kèm `summary: { pending, approved, rejected }`.
- `GET /applications/:id` — `student` (kèm `totalDebt`), `roomType`, `requestedRoom` (kèm `buildingCode`, `floor`, `availableSlots`, `beds`), `estimatedInvoices`, và khi đã xử lý: `reviewedAt`, `reviewNote`, `assigned`, `contractCode`.
- `POST /applications` (staff lập hộ) · `PATCH /:id/approve { roomId? }` · `PATCH /:id/reject { reviewNote ≥ 10 ký tự }`.
- **Duyệt** theo đúng thứ tự BR-36: lấy giường `available` **số nhỏ nhất bằng một lệnh cập nhật có điều kiện** → tạo Residency → tạo Contract (`active`, giá chốt từ loại phòng) → tạo **2 hóa đơn riêng** (cọc + tháng đầu, BR-25, hạn = `max(startDate, ngày duyệt) + 7`, BR-26) → cập nhật đơn. Lỗi giữa chừng phải **trả giường** về `available`.
- Mã lỗi: `409 ROOM_FULL`, `422 ROOM_TYPE_MISMATCH`, `422 GENDER_MISMATCH`, `422 APPLICATION_NOT_PENDING`, `422 STUDENT_HAS_ACTIVE_CONTRACT`, `409 DUPLICATE_PENDING_APPLICATION`.
- Hệ quả: **`POST /residencies`, `POST /contracts`, `PATCH /contracts/:id/activate` phải bỏ** — Residency và Contract chỉ sinh ra từ việc duyệt đơn.

### 3.8. Hợp đồng — P0 ⚠️

| Lệch | Cần làm | Trích dẫn |
|---|---|---|
| Tên trường `contractNumber` (`HD-YYYYMM-XXXX`), `roomFeeSnapshot`, `depositStatus` | Theo `DATA-SCHEMA` 3.7: `contractCode` (`HD-YYYY-XXXXX`), `monthlyPrice`, `depositAmount`, `depositRefunded`, `terminationReason`, `terminatedAt`, `terms` | `contract.model.js` |
| Trạng thái có `pending` + endpoint tạo/kích hoạt | Chỉ `active`, `expired`, `terminated`. **Bỏ** `POST /contracts`, `PATCH /:id/activate` (🗑️) | `contract.routes.js` |
| `GET /contracts`: không lọc `buildingId`, `roomTypeId`; `search` chỉ theo mã; item lồng sâu `residencyId → bedId → roomId → buildingId` | Theo `API.md` mục 6 (bản 1.2.2): lọc `status`, `buildingId`, `roomTypeId`, `expiringInDays`, `search` (mã HĐ, MSSV, tên, mã giường); item **phẳng**: `studentName`, `studentCode`, `bedCode`, `roomNumber`, `buildingName`, `buildingCode`, `roomTypeName`, `tier`, `isExpiring`, `totalDebt`; kèm `summary: { all, active, expiring, expired, terminated }` | `contract.service.js:34-78` |
| `GET /contracts/expiring` hỏng (G1) | Sửa G1 hoặc bỏ endpoint này (FE dùng `?expiringInDays=30`) | `contract.routes.js:25-28` |
| `GET /contracts/:id` không có hóa đơn, lịch sử | Thêm `student`, `depositStatus`, `invoices`, `pendingRequests`, `unpaidSupplyOrders`, `history` | `contract.service.js:88-117` |
| `PATCH /:id/terminate` **không đọc body**, không kiểm tra trạng thái, **luôn đặt `depositStatus='refunded'`**, không quyết toán | Body `{ reason ≥ 10, terminationDate }`; chỉ khi `active` (`422 CONTRACT_NOT_ACTIVE`); hủy đơn nhu yếu phẩm chưa trả (BR-97); tính tiền phòng kỳ dở (BR-31); quyết toán cọc như trả phòng; trả `settlement` | `contract.controller.js:35-38`, `contract.service.js:200-221` |
| `PUT /:id` cho sửa ngày, giá, cọc | Chỉ sửa `terms` — ngày đổi qua yêu cầu gia hạn | `contract.validation.js:30-36` |

### 3.9. Yêu cầu gia hạn / trả phòng — P0 ⚠️

Theo **`API.md` mục 9** (bản 1.2.3) và **mục 10** (bản 1.2.4).

| Lệch | Cần làm | Trích dẫn |
|---|---|---|
| Router dùng chung cho `/api/requests` **và** `/api/portal/my-requests` → route duyệt/từ chối cũng có ở cổng SV | Tách router cổng SV chỉ gồm `GET /`, `POST /`, `DELETE /:id` | `app.js:86-87` |
| `GET /requests` không có `search`, `summary`, `requestCode`; item lồng `studentId`, `contractId` | `search` (tên, MSSV, mã HĐ, mã giường, mã yêu cầu); `summary: { pending, approved, rejected, byType }`; `requestCode`; trường phẳng `studentName`, `studentCode`, `contractCode`, `bedCode`, `buildingName`, `contractEndDate`, `outstandingDebt` | `request.service.js:78-97` |
| `GET /requests/:id` chưa có số tạm tính | Thêm `student`, `contract`, `unpaidInvoices`, `unpaidSupplyOrders`, `readySupplyOrders`; trả phòng chờ duyệt: `settlementPreview` + `checklist`; gia hạn chờ duyệt: `renewalPreview` | `request.service.js:110-146` |
| Tạo yêu cầu không kiểm tra ngày | Gia hạn: ngày mới > `endDate` (BR-72). Trả phòng: từ hôm nay tới `endDate`, **lý do bắt buộc** | `request.service.js:23-53` |
| Duyệt trả phòng **không tính tiền phòng kỳ dở**, **không hủy đơn nhu yếu phẩm chưa trả**, **không tất toán hóa đơn nợ cũ** sau khi trừ cọc (nợ bị tính 2 lần: hóa đơn cũ vẫn `unpaid` + hóa đơn `SETTLE-`) | Làm đủ chuỗi BR-74 → BR-77 + BR-31 + BR-97; nhận `refundMethod` ghi vào Payment hoàn tiền; bỏ ràng buộc `amount ≥ 1000` cho Payment `refund` (hoàn 1–999 đ đang lỗi 400); `settlement` trả thêm `proratedRent`, `refundMethod`, `cancelledSupplyOrders`. Duyệt xong hủy các yêu cầu khác đang chờ của hợp đồng | `request.service.js:233-349`, `payment.model.js` |
| Duyệt gia hạn trả `{ request, contract }` | Trả `{ request, renewal: { previousEndDate, newEndDate, extraMonths }, settlement: null }`; sinh hóa đơn tháng cho kỳ gia hạn theo BR-73 | `request.service.js:195-228` |
| Duyệt không kiểm tra hợp đồng còn `active` | `422 CONTRACT_NOT_ACTIVE` | `request.service.js:178-190` |

✅ Đã đúng: `422 STUDENT_HAS_DEBT` kèm `data.outstandingDebt` + gửi lại `forceConfirm: true`; `422 REQUEST_NOT_PENDING`; `409 DUPLICATE_PENDING_REQUEST`; sinh viên chỉ thấy yêu cầu của mình.

### 3.10. Cổng sinh viên `/portal/*` — P0 ❌ (trừ `my-requests`)

Mọi endpoint lấy danh tính **từ JWT** (BR-86). Định dạng: **`API.md` mục 10**.

| Endpoint | Màn FE | Ưu tiên | Ghi chú định dạng FE đang dùng |
|---|---|---|---|
| `GET /portal/profile` | SCR-61, 62, 69 | P0 | Hồ sơ `Student` (cần `fullName`, `studentCode`, `gender`, `faculty`, `className`) |
| `GET /portal/my-residence` | SCR-61, 66, header cổng SV | **P0** | Xem **`API.md` mục 10** (bản 1.2.8): `{ hasResidence: false }` hoặc `{ hasResidence: true, contract, roomType, includedInRoom, roommates, debtSummary }` |
| `GET /portal/my-applications` · `POST` · `DELETE /:id` | SCR-61, 62 | **P0** | Mảng đơn của mình, **mới nhất lên đầu**, cùng định dạng item của `GET /applications`. Tạo đơn không giữ chỗ (BR-34) |
| `GET /portal/my-requests` · `POST` · `DELETE /:id` | SCR-66 | P0 ⚠️ | Đã có — xem 3.9 (kiểm tra ngày, tách router) |
| `GET /portal/my-invoices` · `/:id` | SCR-61, 64 | P0 (trang chủ) / P1 | Hóa đơn của mình, có `lineItems`, `remainingAmount` |
| `GET /portal/supply-items` · `GET/POST /portal/my-supply-orders` · `PATCH /:id/cancel` | SCR-61, 67, 68 | P0 (trang chủ gợi ý) / P1 | Xem `API.md` mục 10–11 |
| `GET /portal/my-contracts`, `GET /portal/my-payments` | SCR-63, 64 | P1 | |

> Hiện `GET /invoices`, `GET /payments`, `GET /contracts/:id` cho role `student` xem đồ của mình — **giữ quyền đó** nhưng FE chỉ gọi qua `/portal/*` để tách rõ.

### 3.11. Dashboard — P0 ⚠️

Định dạng chuẩn ở **`API.md` mục 12** (bản 1.2.5). FE đang có lớp chuyển đổi tạm để chạy được với bản hiện tại, nhưng cần backend sửa:

| Lệch | Cần làm | Trích dẫn |
|---|---|---|
| Tên trường `totalBeds`, `occupancyRate`, `totalOutstandingDebt`, `queue.*` | Đổi theo `API.md`: `occupancy.{total,occupied,available,maintenance,rate}`, `finance.{totalDebt,overdueInvoiceCount,overdueAmount}` | `dashboard.service.js:163-180` |
| **`rate = occupied / total`** | `occupied / (total − maintenance)` (FR-70) — sửa ở cả `/summary` và `/occupancy` | `dashboard.service.js:46,82` |
| Thiếu | `residents.{activeStudents, activeContracts, expiringIn30Days, contractsByStatus}`, `pendingRequests.{renewal, checkout}`, `pendingApplications`, `supplyOrdersReady`, `finance.overdueAmount` | idem |
| `byBuilding[].gender` luôn `undefined` | Bỏ (giới tính ở mức phòng) | `dashboard.service.js:60-95` |
| `GET /dashboard/revenue` bỏ qua `?months`; không có trong `API.md` | P2 — FE chưa dùng; nếu giữ thì lọc đúng số tháng và thêm vào `API.md` | `dashboard.controller.js:34` |

### 3.12. Phí, chỉ số điện nước, hóa đơn — P1 ⚠️

| Lệch | Cần làm | Trích dẫn |
|---|---|---|
| FeeType dùng `unitPrice`, `isMetered`, mã viết hoa `ELECTRICITY`/`WATER`; chưa seed | Theo `DATA-SCHEMA` 3.8: `defaultAmount`, `isRecurring`, mã `rent`, `electricity`, `water`, `deposit`, `supplies`, `other`. Seed 6 loại | `fee-type.model.js`, `fee.service.js:101-105` |
| `GET /utility-readings` không phân trang, không Joi; `PUT` không Joi | Joi cho cả hai; trả `{ items, total, page, limit }` (hoặc thống nhất mảng và ghi rõ trong `API.md`) | `fee.service.js:51-72, 134-166` |
| Invoice dùng `items[{name,...}]`, không có `remainingAmount`, `type` thiếu `supplies` | `lineItems[{ feeTypeId, description, quantity, unitPrice, amount }]`, trả thêm `remainingAmount`, thêm `supplies` | `invoice.model.js` |
| `POST /invoices/generate` trả `{ totalInvoicesCreated, invoices }`, **bỏ qua** sinh viên đã có hóa đơn tháng | Trả `{ created, updated, totalAmount, skipped[{roomId, roomNumber, reason}] }`; **bổ sung dòng điện nước** vào hóa đơn tháng đã có (BR-48) thay vì bỏ qua | `fee.service.js:189-326` |
| `GET /invoices/:id` không có `payments` | Thêm danh sách thanh toán của hóa đơn | `fee.service.js:363-380` |
| `GET /invoices/overdue` bỏ sót hóa đơn đã ở trạng thái `overdue` | Lọc `status in [unpaid, partial, overdue]` và `dueDate < now` | `fee.service.js:419-427` |
| `POST /invoices` không kiểm tra `amount = quantity × unitPrice` | Tự tính `amount`, không nhận từ client | `fee.service.js:382-396` |

### 3.13. Thanh toán — P1 ⚠️

| Lệch | Cần làm | Trích dẫn |
|---|---|---|
| **`GET /payments/vnpay/return` lỗi 500** (đọc `req.body` khi GET) | Đọc tham số từ `req.query` | `payment.controller.js:41` |
| Trường `paymentMethod`; body offline không có `method` | Theo `DATA-SCHEMA` 3.11: `method`, `gatewayTransactionId`; body offline `{ invoiceId, amount, method: cash\|bank_transfer, note }` | `payment.model.js`, `payment.validation.js:8-18` |
| Trạng thái có cả `completed` và `success` | Chỉ `pending`, `success`, `failed`, `expired` | `enums.js:40` |
| `POST /online/checkout` trả `paymentUrl` | `redirectUrl` như `API.md`; body `{ invoiceId, gateway, amount? }` | `payment.service.js:94-143` |
| Có 2 bản trùng `/cash`, `/vnpay/create-url`, `/vnpay/verify` | Giữ `/offline`, `/online/checkout`, `/webhook/vnpay` (🗑️ bản trùng) | `payment.routes.js` |
| `VNP_HASH_SECRET` thiếu thì tạo URL và kiểm chữ ký dùng **2 secret mặc định khác nhau** | Bắt buộc có biến môi trường, không có mặc định | `vnpay.helper.js:43, 81` |
| `GET /payments` không lọc `type` | Thêm `?type=payment\|refund` | `payment.service.js:257-261` |
| Thanh toán đủ hóa đơn `supplies` → đơn hàng sang `ready` | Làm khi có module nhu yếu phẩm (BR-95) | — |

### 3.14. Nhu yếu phẩm — P1 ❌

Chưa có. Làm theo **`API.md` mục 11** + **`DATA-SCHEMA` 3.15–3.16** + **`03` BR-90 → BR-97**: `supply-items` (CRUD, `includedInRoomTypes`), `supply-orders` (danh sách + `summary`, chi tiết, giao hàng, hủy), đặt hàng ở cổng SV sinh **1 hóa đơn `supplies`**, giá lấy từ danh mục (không tin giá client gửi), Scheduler hủy đơn quá hạn thanh toán.

### 3.15. Lưu trú `/residencies` — P2

| Endpoint | Đề xuất |
|---|---|
| `POST /residencies` (nhận `bedId`) | 🗑️ Bỏ — trái BR-38 (không API nào nhận mã giường từ client) |
| `PATCH /residencies/:id/close` | 🗑️ Bỏ hoặc chỉ dùng nội bộ — đóng lưu trú mà **không** đụng hợp đồng làm lệch dữ liệu; đi qua duyệt trả phòng / chấm dứt hợp đồng |
| `GET /residencies`, `GET /:id` | Giữ (tra cứu lịch sử lưu trú, FR-39) |

---

## 4. Danh sách API thừa nên bỏ (🗑️)

| # | Endpoint | Lý do |
|---|---|---|
| 1 | `POST /api/residencies` | v1.2: lưu trú chỉ sinh ra khi duyệt đơn; nhận `bedId` trái BR-38 |
| 2 | `POST /api/contracts` | v1.2: hợp đồng sinh ra khi duyệt đơn |
| 3 | `PATCH /api/contracts/:id/activate` | v1.2: không còn trạng thái `pending` |
| 4 | `GET/POST /api/rooms/:roomId/beds`, `POST /api/rooms/:roomId/beds/generate` | v1.2: giường tự sinh, không thêm tay; danh sách giường ở `GET /rooms/:id` |
| 5 | `PATCH /api/residencies/:id/close` | Đóng lưu trú mà không cập nhật hợp đồng |
| 6 | `POST /api/auth/users/:id/reset-password` | Trùng `POST /api/users/:id/reset-password` |
| 7 | `POST /api/payments/cash`, `/vnpay/create-url`, `/vnpay/verify` | Trùng `/offline`, `/online/checkout`, `/webhook/vnpay` |
| 8 | Route duyệt/từ chối dưới `/api/portal/my-requests` | Router dùng chung; cổng SV chỉ cần xem, gửi, hủy |

---

## 5. Thứ tự đề xuất cho backend

**Đợt 1 — mở khóa 16 màn FE đã xong (P0):**
1. Lỗi chung G1 → G6.
2. Loại phòng + đổi mô hình phòng/giường (3.5, 3.6) — nền của mọi thứ phía sau.
3. Đơn đăng ký + cổng SV `my-applications` (3.7, 3.10) — kèm bỏ API tạo lưu trú/hợp đồng tay.
4. Hợp đồng theo v1.2 (3.8).
5. Yêu cầu + quyết toán đầy đủ (3.9).
6. Cổng SV `profile`, `my-residence` (3.10).
7. Tài khoản `/users` (3.2), Sinh viên bổ sung trường (3.3), Tòa nhà (3.4), Dashboard (3.11).

**Đợt 2 — cho các màn FE sắp làm (P1):** phí & hóa đơn (3.12) → thanh toán (3.13) → nhu yếu phẩm (3.14) → cổng SV hóa đơn, mua sắm, chỗ ở, thanh toán.

**Đợt 3 — dọn dẹp (P2):** bỏ API thừa (mục 4), `/residencies` (3.15), `/dashboard/revenue`.

> Mỗi khi xong một nhóm, báo FE tên nhóm để bật chạy backend thật cho nhóm đó và chạy lại checklist nghiệm thu tương ứng trong `15-CHECKLIST-NGHIEM-THU-FE.md`.

---

## 6. Cần chốt giữa hai bên

| # | Câu hỏi | Đề xuất của FE |
|---|---|---|
| 1 | Giữ tên trường theo `DATA-SCHEMA` (`contractCode`, `monthlyPrice`, `lineItems`, `method`) hay đổi docs theo code BE? | **Theo docs** — FE đã làm 16 màn theo docs |
| 2 | Danh sách không phân trang (`/buildings`, `/fee-types`, `/utility-readings`) trả mảng hay `{ items }`? | Mảng cho danh mục ngắn (`buildings`, `fee-types`); `{ items, total, page, limit }` cho `utility-readings` |
| 3 | Lỗi trùng dữ liệu: mã riêng từng loại hay `DUPLICATE_ENTRY` + field? | `DUPLICATE_ENTRY` + `data.errors[{field,message}]` để FE báo lỗi đúng ô |
| 4 | Seed dữ liệu thử cho DB chung | Thống nhất một script seed theo v1.2 (loại phòng, phòng có giường, sinh viên, vài đơn chờ duyệt) để FE kiểm thử — **không chạy trên DB chung khi chưa báo cả nhóm** |

---

## Lịch sử phiên bản

| Phiên bản | Ngày | Người | Nội dung |
|---|---|---|---|
| 1.0 | 15/09/2026 | FE Lead | Bản đầu — đối chiếu `API.md` v1.2.8 với `BE_QLKTX` commit `ab7db8c` |
