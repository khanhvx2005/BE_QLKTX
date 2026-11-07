# 16 – YÊU CẦU API TỪ FRONTEND GỬI BACKEND

**Hệ thống:** DMS – Hệ thống quản lý ký túc xá
**Người đọc:** nhóm Backend (3 người)
**Người lập:** FE Lead · **Ngày:** 15/09/2026 · **Cập nhật:** 16/09/2026 (bản 1.11 — bổ sung mục 6, 7)
**Đối chiếu:** `docs/API.md` **v1.2.18** ↔ repo `BE_QLKTX` commit `ab7db8c` (first-commit). Trích dẫn `file:dòng` trỏ vào `BE_QLKTX/src`.

> **Tóm tắt một dòng:** backend đang làm theo API **v1.1** (xếp giường bằng tay). Frontend đã làm xong **toàn bộ 31/31 màn** theo **v1.2** (đăng ký theo phòng, giường tự gán, nhu yếu phẩm). Frontend gọi **82 endpoint**: **10 dùng được ngay**, **41 có nhưng lệch** (phần lớn chỉ đổi tên trường), **34 chưa có** (bảng đầy đủ ở **mục 7**). Cần thêm: **5 nhóm API còn thiếu**, sửa **6 lỗi chung** (mục 2), bỏ **8 API thừa** của v1.1 (mục 4).

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
| **P1** | Màn FE vẫn mở được nhưng thiếu một phần chức năng, hoặc có cách làm tay thay thế |
| **P2** | Dọn dẹp, bảo mật, lỗi tiềm ẩn — không chặn giao diện |

- **Nguồn sự thật** là `docs/API.md` (định dạng request/response, mã lỗi mục 13) và `docs/DATA-SCHEMA.md` (tên trường). Tài liệu này **không lặp lại** định dạng đã có ở `API.md`, chỉ chỉ ra chỗ lệch và việc cần làm.
- Mọi phần FE bổ sung vào `API.md` nằm ở bảng **Change Log** cuối file, bản **1.2.1 → 1.2.18**.
- **Đã đọc bản trước (bàn giao ngày 15/09, `API.md` v1.2.8)?** Xem thẳng **mục 6** — chỉ liệt kê phần thêm mới sau đó. **Mục 7** là bảng đối chiếu từng endpoint để tự kiểm.
- Frontend có lớp dữ liệu giả (`src/mocks/`) trả **đúng** định dạng trong `API.md` — khi phân vân, chạy FE ở chế độ dữ liệu giả (`VITE_USE_MOCK=true`), mở F12 → Network để xem request/response mẫu.

---

## 1. Bảng tổng hợp

| # | Nhóm API | Màn FE dùng | Trạng thái | Ưu tiên |
|---|---|---|---|---|
| 1 | Auth (`/auth/*`) | SCR-01, 02, 03 | ⚠️ `register` sai nghiệp vụ (mục 3.1) | P0 |
| 2 | Tài khoản (`/users`) | SCR-81 | ❌ chỉ có reset mật khẩu | P0 |
| 3 | Sinh viên (`/students`) | SCR-11, 31, 81 | ⚠️ thiếu trường | P0 |
| 4 | Tòa nhà (`/buildings`) | SCR-21, 23 | ⚠️ | P0 |
| 5 | **Loại phòng (`/room-types`)** | SCR-22, 23, 62, 10 | ❌ | **P0** |
| 6 | Phòng & giường (`/rooms`, `/beds`) | SCR-23, 31, 62 | ⚠️ lệch mô hình v1.1 | **P0** |
| 7 | **Đơn đăng ký (`/applications`)** | SCR-31 | ❌ | **P0** |
| 8 | Hợp đồng (`/contracts`) | SCR-32, 61 | ⚠️ lệch nhiều | P0 |
| 9 | Yêu cầu gia hạn/trả phòng (`/requests`) | SCR-41, 66 | ⚠️ thiếu quyết toán đầy đủ | P0 |
| 10 | **Cổng sinh viên (`/portal/*`)** | SCR-61, 62, 63→69 | ❌ chỉ có `my-requests` (13 endpoint thiếu) | **P0** |
| 11 | Dashboard (`/dashboard`) | SCR-10 | ⚠️ định dạng khác | P0 |
| 12 | Phí, chỉ số, hóa đơn (`/fee-types`, `/utility-readings`, `/invoices`) | SCR-51→55, 82 | ⚠️ lệch tên trường · ❌ thiếu `generation-preview` | P0 |
| 13 | Thanh toán (`/payments`) | SCR-54→56, 64, 65 | ⚠️ thiếu lọc, `bankReference`, đối soát thật | P0 |
| 14 | **Nhu yếu phẩm (`/supply-items`, `/supply-orders`)** | SCR-67, 68, 71 | ❌ toàn bộ module | **P0** |
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
| `POST /auth/register` | ❌ **sai nghiệp vụ** | Hiện **tạo mới hồ sơ `Student`** từ dữ liệu người dùng nhập. Theo FR-80/FR-81 phải **liên kết với hồ sơ sinh viên ban quản lý đã có**: sai mã → `422 STUDENT_NOT_FOUND`, sai họ tên → `422 STUDENT_INFO_MISMATCH`, đã có tài khoản → `409 STUDENT_ALREADY_HAS_ACCOUNT` (`API.md` bản 1.2.18). Tạo hồ sơ tự do khiến tài khoản không gắn được với hồ sơ thật, sinh viên không có phòng/hợp đồng. Kèm mã lỗi trùng (G5) và luật mật khẩu (G6) |
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
| `GET /portal/profile` | SCR-61, 62, **69 (đã xong)** | P0 | Hồ sơ `Student`: `fullName`, `studentCode`, `gender`, `dob`, `faculty`, `className`, `phone`, `email`, `emergencyContact { name, relationship, phone }` — màn hồ sơ chỉ đọc (FR-86) |
| `GET /portal/my-residence` | SCR-61, 66, header cổng SV | **P0** | Xem **`API.md` mục 10** (bản 1.2.8): `{ hasResidence: false }` hoặc `{ hasResidence: true, contract, roomType, includedInRoom, roommates, debtSummary }` |
| `GET /portal/my-applications` · `POST` · `DELETE /:id` | SCR-61, 62 | **P0** | Mảng đơn của mình, **mới nhất lên đầu**, cùng định dạng item của `GET /applications`. Tạo đơn không giữ chỗ (BR-34) |
| `GET /portal/my-requests` · `POST` · `DELETE /:id` | SCR-66 | P0 ⚠️ | Đã có — xem 3.9 (kiểm tra ngày, tách router) |
| `GET /portal/my-invoices` · `/:id` | SCR-61, **64 (đã xong)** | **P0** | Hóa đơn của mình, có `lineItems`, `remainingAmount`; chi tiết kèm `payments` như `API.md` bản 1.2.12. Mô tả dòng điện nước giữ hậu tố `(90 kWh, chia đều 4 người)` để màn sinh viên giải thích cách chia tiền |
| `GET /portal/supply-items` · `GET/POST /portal/my-supply-orders` · `PATCH /:id/cancel` | SCR-61, **67, 68 (đã xong)** | **P0** | Xem `API.md` mục 10–11 (bản 1.2.17): cửa hàng đã lọc sẵn món cấp sẵn/ngừng bán, đặt hàng chỉ nhận `{ supplyItemId, quantity }` (1–5), trả kèm `invoice` để sinh viên thanh toán ngay, hủy đơn thì hủy cả hóa đơn |
| `GET /portal/my-contracts` | **SCR-63 (đã xong)** | **P0** | Mảng hợp đồng của mình, mới nhất lên đầu; hợp đồng cũ cần `contractCode`, `bedCode`, `buildingName`, `startDate`, `endDate`, `status`, `terminationReason` để dựng bảng lịch sử lưu trú (FR-39) |
| `GET /portal/my-payments` | **SCR-65 (đã xong)** | **P0** | Thêm lọc `?transactionRef=` — màn Kết quả thanh toán hỏi lại tối đa 5 lần, mỗi lần cách 2 giây (`API.md` bản 1.2.16) |

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
| FeeType dùng `unitPrice`, `isMetered`, mã viết hoa (DB chung đang có `ROOM_FEE`, `ELECTRICITY`, `WATER`, `DEPOSIT`, `INTERNET`); thiếu `supplies`, `other` | Theo `DATA-SCHEMA` 3.8: `defaultAmount`, `isRecurring`, mã `rent`, `electricity`, `water`, `deposit`, `supplies`, `other`. Seed đủ 6 loại hệ thống. FE tạm chuyển đổi khi đọc danh sách, **chưa** chuyển đổi khi thêm/sửa | `fee-type.model.js`, `fee.service.js:101-105` |
| `GET /fee-types` chỉ trả loại đang dùng; không có `isSystem`; cho ngừng dùng cả loại hệ thống | Theo `API.md` mục 7 (bản 1.2.9): `?includeInactive=true`, trả `isSystem`; ngừng dùng loại hệ thống → `422 FEE_TYPE_REQUIRED`; `PUT` nhận `{ name, unit, defaultAmount, isRecurring, isActive }`, không đổi `code` | `fee.service.js:20-49` |
| `GET /utility-readings` không phân trang, không Joi, `roomId` bị populate thành object, lọc `buildingId` trong bộ nhớ; `PUT` không Joi; trùng kỳ trả `READING_ALREADY_EXISTS` | Theo `API.md` mục 7 (bản 1.2.10): Joi cho cả hai; trả `{ items, total, page, limit }`; item phẳng `roomId`, `roomNumber`, `buildingId`, tiêu thụ + thành tiền, `recordedByName`, `recordedAt`; chặn kỳ tương lai; trùng → `409 DUPLICATE_ENTRY`. FE (SCR-51) đang nhận được cả dạng hiện tại khi đọc | `fee.service.js:51-72, 134-166` |
| Invoice dùng `items[{name,...}]`, không có `remainingAmount`, `type` thiếu `supplies` | `lineItems[{ feeTypeId, description, quantity, unitPrice, amount }]`, trả thêm `remainingAmount`, thêm `supplies` | `invoice.model.js` |
| `POST /invoices/generate` trả `{ totalInvoicesCreated, invoices }`, **bỏ qua** sinh viên đã có hóa đơn tháng | Trả `{ created, updated, totalAmount, eligibleStudents, readyRooms, skipped[{roomId, roomNumber, buildingCode, code, reason}] }`; **bổ sung dòng điện nước** vào hóa đơn tháng đã có (BR-48) thay vì bỏ qua; đánh dấu chỉ số `isInvoiced` | `fee.service.js:189-326` |
| ❌ Chưa có xem trước lập hàng loạt | **Thêm `GET /invoices/generation-preview`** (`API.md` bản 1.2.11) — cùng cách tính, không ghi. Khai báo route **trước** `/invoices/:id`. Màn SCR-53 khóa nút Lập khi chưa xem trước được | `fee.routes.js:44-53` |
| `GET /invoices` không có `search`, `buildingId`, `summary`; `studentId` bị populate; không có `remainingAmount`, phòng/tòa | Theo `API.md` bản 1.2.11: trường phẳng `studentName`, `studentCode`, `roomNumber`, `buildingCode`; `summary` của cả tập đã lọc, bỏ hóa đơn hủy | `fee.service.js:328-361` |
| Hủy hóa đơn: cho hủy cả hóa đơn nhu yếu phẩm, quyết toán; không mở khóa chỉ số khi hủy hết hóa đơn tháng của phòng | `422 INVOICE_NOT_CANCELLABLE` cho `supplies`/`settlement`/đã hủy; mở lại `isInvoiced` của chỉ số khi phòng không còn hóa đơn tháng nào có tiền điện nước | `fee.service.js:398-417` |
| `GET /invoices/:id` không có `payments`, mã hợp đồng, phòng; vẫn dùng `items[{ name }]` | Theo `API.md` bản 1.2.12: `contractCode`, `note`, `payments[]` (cũ → mới, có `recordedByName`, `bankReference`), `supplyOrder`. FE tạm lấy lịch sử từ `GET /payments?invoiceId=` | `fee.service.js:363-380` |
| `GET /invoices/overdue` bỏ sót hóa đơn đã ở trạng thái `overdue` | Lọc `status in [unpaid, partial, overdue]` và `dueDate < now` | `fee.service.js:419-427` |
| `POST /invoices` không kiểm tra `amount = quantity × unitPrice` | Tự tính `amount`, không nhận từ client; `type` luôn `other`, `billingPeriod` null; hợp đồng phải `active`; từ chối loại phí `rent`, `deposit`, `supplies` (`API.md` bản 1.2.11) | `fee.service.js:382-396` |

### 3.13. Thanh toán — P1 ⚠️

| Lệch | Cần làm | Trích dẫn |
|---|---|---|
| **`GET /payments/vnpay/return` lỗi 500** (đọc `req.body` khi GET) | Đọc tham số từ `req.query` | `payment.controller.js:41` |
| Trường `paymentMethod`; body offline không có `method`, `paidAt`, `bankReference`; cho chuyển khoản không cần mã | Theo `API.md` bản 1.2.12 + `DATA-SCHEMA` 3.11 (bản 1.2.1): `method`, `gatewayTransactionId`, **`bankReference`** (bắt buộc khi chuyển khoản, không trùng → `409 DUPLICATE_ENTRY`); body `{ invoiceId, amount, method, paidAt, bankReference?, note? }`; trả `{ payment, invoice, supplyOrder }`; hóa đơn đã hủy → `422 INVOICE_CANCELLED`; `paidAmount` tính lại từ các thanh toán thành công (BR-43) | `payment.model.js`, `payment.validation.js:8-18` |
| Trạng thái có cả `completed` và `success` | Chỉ `pending`, `success`, `failed`, `expired` | `enums.js:40` |
| `POST /online/checkout` trả `paymentUrl` | `redirectUrl` như `API.md`; body `{ invoiceId, gateway, amount? }` | `payment.service.js:94-143` |
| Có 2 bản trùng `/cash`, `/vnpay/create-url`, `/vnpay/verify` | Giữ `/offline`, `/online/checkout`, `/webhook/vnpay` (🗑️ bản trùng) | `payment.routes.js` |
| `VNP_HASH_SECRET` thiếu thì tạo URL và kiểm chữ ký dùng **2 secret mặc định khác nhau** | Bắt buộc có biến môi trường, không có mặc định | `vnpay.helper.js:43, 81` |
| `GET /payments` không lọc `type`, `search`, `from`/`to`; không có `summary`; `studentId`/`invoiceId` bị populate; giao dịch tại quầy không có `transactionRef` | Theo `API.md` bản 1.2.13: thêm `type`, `search`, `from`, `to`, `summary`; trả trường phẳng (`studentName`, `invoiceCode`…); sinh `transactionRef` cho cả giao dịch tại quầy; sắp xếp theo `paidAt` rồi `createdAt`. FE (SCR-56) tạm chuyển đổi khi đọc | `payment.service.js:243-280` |
| `POST /payments/:id/reconcile` chưa hỏi lại cổng thanh toán; hết hạn sau **30 phút** (docs BR-64: 15 phút); giao dịch không `pending` vẫn trả 200 | Gọi lại cổng, cập nhật `Payment` + hóa đơn (BR-43), quá 15 phút → `expired` (BR-64); chặn giao dịch tại quầy (`422 PAYMENT_NOT_ONLINE`) và giao dịch không còn `pending` (`422 PAYMENT_NOT_PENDING`); message nêu rõ kết quả vì FE hiện thẳng cho người dùng | `payment.service.js:220-245` |
| Thanh toán đủ hóa đơn `supplies` → đơn hàng sang `ready` | Làm khi có module nhu yếu phẩm (BR-95) | — |

### 3.14. Nhu yếu phẩm — P1 ❌

Chưa có (`/api/supply-items`, `/api/supply-orders` đều trả `404`). Màn SCR-71 đã xong và đang chạy bằng dữ liệu giả. Làm theo **`API.md` mục 11** (bản 1.2.14) + **`DATA-SCHEMA` 3.15–3.16** + **`03` BR-90 → BR-97**: `supply-items` (CRUD, `includedInRoomTypes`), `supply-orders` (danh sách + `summary`, chi tiết, giao hàng, hủy), đặt hàng ở cổng SV sinh **1 hóa đơn `supplies`**, giá lấy từ danh mục (không tin giá client gửi), Scheduler hủy đơn quá hạn thanh toán.

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

**Frontend đã xong toàn bộ 31/31 màn**, nên không còn màn nào phải chờ. Thứ tự dưới đây xếp theo *luồng nghiệp vụ chạy được từ đầu đến cuối*: làm xong mỗi bước là demo thêm được một đoạn.

**Bước 1 — nền dữ liệu (P0, chặn mọi thứ phía sau):**
1. Lỗi chung G1 → G6 (mục 2) — riêng G1 làm hỏng nhiều endpoint có lọc.
2. Loại phòng + đổi mô hình phòng/giường (3.5, 3.6), kèm `GET /rooms/available`.
3. Tài khoản `/users` (3.2) và Sinh viên bổ sung trường (3.3), Tòa nhà (3.4).

**Bước 2 — luồng "sinh viên vào ở" (P0):**
4. Sửa `POST /auth/register` liên kết hồ sơ có sẵn (3.1).
5. Đơn đăng ký + cổng SV `my-applications` (3.7, 3.10), kèm bỏ API tạo lưu trú/hợp đồng tay.
6. Hợp đồng theo v1.2 (3.8) + cổng SV `profile`, `my-residence`, `my-contracts`.

**Bước 3 — luồng tiền (P0):**
7. Loại phí (3.12) → chỉ số điện nước → hóa đơn + `GET /invoices/generation-preview`.
8. Thanh toán (3.13): thu tại quầy, thanh toán online, đối soát.
9. Cổng SV `my-invoices`, `my-payments?transactionRef=` — mở khóa màn kết quả thanh toán.

**Bước 4 — phần còn lại (P0/P1):**
10. Nhu yếu phẩm quản trị (3.14) + cổng SV mua sắm, đơn hàng của tôi.
11. Yêu cầu gia hạn/trả phòng + quyết toán đầy đủ (3.9).
12. Dashboard (3.11).

**Bước 5 — dọn dẹp (P2):** bỏ API thừa (mục 4), `/residencies` (3.15), `/dashboard/revenue`.

> Mỗi khi xong một nhóm, báo FE tên nhóm để bật chạy backend thật cho nhóm đó và chạy lại checklist nghiệm thu tương ứng trong `15-CHECKLIST-NGHIEM-THU-FE.md`.

---

## 6. Phần thêm sau bản bàn giao đầu (API.md v1.2.8 → v1.2.18)

Bản bàn giao đầu dừng ở `API.md` **v1.2.8**. Từ đó frontend làm xong **15 màn còn lại**, nên `API.md` có thêm 10 bản nhỏ. Bảng này gom đúng phần **mới so với bản các bạn đang cầm**; chi tiết định dạng nằm ở mục tương ứng trong `API.md`.

| `API.md` | Màn FE | Endpoint liên quan | Backend cần thêm / sửa |
|---|---|---|---|
| **1.2.9** | SCR-82 Danh mục loại phí | `GET/POST/PUT /fee-types` | `?includeInactive=true`; trả `isSystem`; đổi sang `defaultAmount`, `isRecurring`, mã chữ thường; chặn ngừng dùng 6 loại hệ thống (`422 FEE_TYPE_REQUIRED`) |
| **1.2.10** | SCR-51 Chỉ số điện nước | `GET/POST/PUT /utility-readings` | Phân trang `{ items, total, page, limit }`; item phẳng (`roomId` không populate) + tiêu thụ + thành tiền + `recordedByName`, `recordedAt`; lọc `roomId`; chặn kỳ tương lai; trùng kỳ → `409 DUPLICATE_ENTRY`; `PUT` giữ đơn giá đã chốt |
| **1.2.11** | SCR-52, SCR-53 Hóa đơn + lập hàng loạt | `GET/POST /invoices`, `POST /invoices/generate`, **`GET /invoices/generation-preview`**, `PATCH /invoices/:id/cancel` | Danh sách: lọc `search`/`buildingId`, trường phẳng, `summary`. **Thêm endpoint xem trước** (GET, không ghi) trả cùng dạng với generate + `eligibleStudents`, `readyRooms`, `skipped[].code`. Hóa đơn lẻ: `type: other`, `billingPeriod: null`, chặn loại phí `rent`/`deposit`/`supplies`. Hủy: `422 INVOICE_NOT_CANCELLABLE`, mở khóa lại chỉ số khi phòng không còn hóa đơn tháng |
| **1.2.12** | SCR-54, SCR-55 Chi tiết hóa đơn + thu tiền | `GET /invoices/:id`, `POST /payments/offline` | Chi tiết kèm `contractCode`, `note`, `payments[]` (có `recordedByName`, `bankReference`), `supplyOrder`. Thu tiền quầy: body `{ invoiceId, amount, method, paidAt, bankReference?, note? }`, trả `{ payment, invoice, supplyOrder }`; **`bankReference` bắt buộc khi chuyển khoản, không trùng**; hóa đơn đã hủy → `422 INVOICE_CANCELLED`. Kèm `DATA-SCHEMA` 1.2.1: thêm trường `Payment.bankReference` |
| **1.2.13** | SCR-56 Lịch sử thanh toán | `GET /payments`, `POST /payments/:id/reconcile` | Danh sách: `search`, `type`, `from`, `to`, `summary`, trường phẳng, sinh `transactionRef` cho cả giao dịch tại quầy. Đối soát: hỏi lại cổng thật, cập nhật hóa đơn (BR-43), quá **15 phút** → `expired` (hiện backend để 30 phút), chặn giao dịch tại quầy (`422 PAYMENT_NOT_ONLINE`) và giao dịch không còn `pending` (`422 PAYMENT_NOT_PENDING`) |
| **1.2.14** | SCR-71 Nhu yếu phẩm (quản trị) | `/supply-items`, `/supply-orders` | **Toàn bộ module còn thiếu.** Đơn hàng: lọc `from`/`to`, `summary` đủ 6 số đếm, trường phẳng `roomCode`, `deliveredByName`; chi tiết kèm `invoice`; hủy cần `cancelReason` ≥ 5 ký tự và hủy luôn hóa đơn |
| **1.2.15** | SCR-63, SCR-69 Chỗ ở & hồ sơ | `GET /portal/profile`, `GET /portal/my-contracts` | Hồ sơ đủ `dob`, `faculty`, `className`, `phone`, `emergencyContact`. `my-contracts` trả cả hợp đồng cũ kèm `terminationReason` để dựng lịch sử lưu trú (FR-39) |
| **1.2.16** | SCR-64, SCR-65 Hóa đơn SV + kết quả thanh toán | `GET /portal/my-invoices(/:id)`, `GET /portal/my-payments?transactionRef=` | Hóa đơn của sinh viên kèm `lineItems`, `remainingAmount`, `payments`. **Thêm lọc `transactionRef`** để màn kết quả hỏi lại giao dịch (tối đa 5 lần, cách 2 giây). Mô tả dòng điện nước giữ hậu tố `(90 kWh, chia đều 4 người)` |
| **1.2.17** | SCR-67, SCR-68 Mua sắm + đơn hàng | `/portal/supply-items`, `/portal/my-supply-orders` | Cửa hàng lọc sẵn món đã cấp sẵn theo loại phòng và món ngừng bán. Đặt hàng chỉ nhận `{ supplyItemId, quantity }` (1–5), trả kèm `invoice` để thanh toán ngay. Sinh viên hủy đơn không cần body, hủy luôn hóa đơn |
| **1.2.18** | SCR-02 Đăng ký tài khoản | `POST /auth/register` | **Sửa nghiệp vụ:** phải **liên kết hồ sơ sinh viên có sẵn**, không tạo hồ sơ mới (FR-80/81). Thêm `422 STUDENT_NOT_FOUND`, `422 STUDENT_INFO_MISMATCH`, `409 STUDENT_ALREADY_HAS_ACCOUNT`; mật khẩu ≥ 8 ký tự có chữ và số |

**Hai endpoint hoàn toàn mới** (chưa có trong bản 1.2.8): `GET /api/invoices/generation-preview` và bộ lọc `GET /api/portal/my-payments?transactionRef=`.

---

## 7. Bảng đối chiếu toàn bộ endpoint frontend đang gọi

**82 endpoint** frontend gọi khi chạy đủ 31 màn, cộng 4 dòng liên quan (cổng thanh toán gọi, hoặc backend đang có mà frontend không dùng) — tổng **86 dòng**. Cột "Backend" là hiện trạng repo `BE_QLKTX` ngày 16/09/2026.

### 7.1. Auth & tài khoản

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `POST /auth/login` | SCR-01 | ✅ | — |
| `POST /auth/logout` | mọi màn | ✅ | — |
| `GET /auth/me` | mọi màn | ✅ | — |
| `PATCH /auth/change-password` | SCR-03 | ✅ (luật mật khẩu G6) | P2 |
| `POST /auth/register` | SCR-02 | ⚠️ **sai nghiệp vụ** — tạo hồ sơ mới thay vì liên kết | **P0** |
| `GET /users` | SCR-81 | ❌ | **P0** |
| `POST /users` | SCR-81 | ❌ | **P0** |
| `PUT /users/:id` | SCR-81 | ❌ | **P0** |
| `PATCH /users/:id/status` | SCR-81 | ❌ | **P0** |
| `POST /users/:id/reset-password` | SCR-81 | ✅ | — |

### 7.2. Sinh viên

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `GET /students` | SCR-11, SCR-81 | ⚠️ thiếu `residence`, `totalDebt`, `hasAccount`, lọc `faculty` | P0 |
| `GET /students/:id` | SCR-11 | ✅ | — |
| `POST /students` · `PUT /students/:id` | SCR-11 | ✅ (mã lỗi trùng G5) | P2 |
| `PATCH /students/:id/deactivate` | SCR-11 | ⚠️ còn kiểm tra hợp đồng `pending` (v1.2 đã bỏ) | P2 |

### 7.3. Cơ sở vật chất

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `GET /buildings` | SCR-21, 23, 32, 51, 52 | ⚠️ thiếu `includeInactive`, `maintenanceBeds` | P0 |
| `POST /buildings` · `PUT /buildings/:id` | SCR-21 | ⚠️ thiếu chặn ngừng hoạt động khi còn người ở | P0 |
| `GET /room-types` | SCR-22, 23, 62, 71, 10 | ❌ | **P0** |
| `POST /room-types` · `PUT /room-types/:id` | SCR-22 | ❌ | **P0** |
| `GET /rooms` | SCR-23, 31, 51 | ⚠️ mô hình v1.1, thiếu `roomTypeId`, `floor`, `maintenanceBeds` | **P0** |
| `GET /rooms/:id` | SCR-23 | ⚠️ giường thiếu `occupant`, `note` | P0 |
| `GET /rooms/available` | SCR-31, 62 | ❌ | **P0** |
| `POST /rooms` · `PUT /rooms/:id` | SCR-23 | ⚠️ chưa tự sinh giường, còn `pricePerBed` | **P0** |
| `PATCH /beds/:id/status` | SCR-23 | ⚠️ chưa nhận `note`, sai mã lỗi | P0 |

### 7.4. Đơn đăng ký · lưu trú · hợp đồng

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `GET /applications` · `/:id` | SCR-31 | ❌ | **P0** |
| `POST /applications` | SCR-31 | ❌ | **P0** |
| `PATCH /applications/:id/approve` | SCR-31 | ❌ — gán giường nguyên tử + 2 hóa đơn (BR-36) | **P0** |
| `PATCH /applications/:id/reject` | SCR-31 | ❌ | **P0** |
| `GET /residencies` | *(chưa màn nào dùng)* | ✅ | — |
| `PATCH /residencies/:id/close` | *(không dùng)* | 🗑️ nên bỏ | P2 |
| `GET /contracts` | SCR-32 | ⚠️ thiếu lọc, `summary`, trường phẳng | P0 |
| `GET /contracts/:id` | SCR-32 | ⚠️ thiếu `invoices`, `history`, `pendingRequests` | P0 |
| `GET /contracts/expiring` | SCR-32, SCR-10 | ⚠️ hỏng vì lỗi chung G1 | P0 |
| `PUT /contracts/:id` | SCR-32 | ⚠️ chỉ nên cho sửa `terms` | P1 |
| `PATCH /contracts/:id/terminate` | SCR-32 | ⚠️ không đọc body, không quyết toán | P0 |

### 7.5. Yêu cầu gia hạn / trả phòng

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `GET /requests` | SCR-41 | ⚠️ thiếu `search`, `summary`, `requestCode` | P0 |
| `GET /requests/:id` | SCR-41 | ⚠️ thiếu `settlementPreview`, `checklist`, `renewalPreview` | **P0** |
| `PATCH /requests/:id/approve` | SCR-41 | ⚠️ thiếu tiền phòng kỳ dở, hủy đơn nhu yếu phẩm, `refundMethod` | **P0** |
| `PATCH /requests/:id/reject` | SCR-41 | ⚠️ | P1 |

### 7.6. Phí · chỉ số · hóa đơn

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `GET /fee-types` | SCR-82, 51 | ⚠️ tên trường v1.1, thiếu `includeInactive`, `isSystem` | P0 |
| `POST /fee-types` · `PUT /fee-types/:id` | SCR-82 | ⚠️ | P0 |
| `GET /utility-readings` | SCR-51 | ⚠️ không phân trang, `roomId` bị populate | P0 |
| `POST /utility-readings` · `PUT /:id` | SCR-51 | ⚠️ thiếu Joi, chưa chặn kỳ tương lai | P0 |
| `GET /invoices` | SCR-52 | ⚠️ thiếu `search`, `buildingId`, `summary`, `remainingAmount` | P0 |
| `GET /invoices/:id` | SCR-54 | ⚠️ thiếu `payments`, `contractCode`, dùng `items` | P0 |
| `POST /invoices` | SCR-52 | ⚠️ chưa tự tính `amount`, chưa chặn loại phí | P1 |
| `POST /invoices/generate` | SCR-53 | ⚠️ bỏ qua sinh viên đã có hóa đơn (mất tiền điện nước — BR-48) | **P0** |
| `GET /invoices/generation-preview` | SCR-53 | ❌ **endpoint mới** | **P0** |
| `PATCH /invoices/:id/cancel` | SCR-52, 54 | ⚠️ thiếu chặn loại `supplies`/`settlement`, chưa mở khóa chỉ số | P1 |

### 7.7. Thanh toán

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `GET /payments` | SCR-56, SCR-54 | ⚠️ thiếu `search`/`type`/`from`/`to`/`summary`, populate object | P0 |
| `POST /payments/offline` | SCR-55 | ⚠️ tên trường khác, thiếu `paidAt`, `bankReference` | **P0** |
| `POST /payments/online/checkout` | SCR-64 | ⚠️ trả `paymentUrl` thay vì `redirectUrl` | P0 |
| `POST /payments/:id/reconcile` | SCR-56 | ⚠️ chưa hỏi cổng, hết hạn 30 phút thay vì 15 | P1 |
| `POST /payments/webhook/vnpay` | *(cổng gọi)* | ✅ — cần cho SCR-65 chạy thật | P0 |
| `GET /payments/vnpay/return` | *(cổng gọi)* | ⚠️ **lỗi 500** (đọc `req.body` khi GET) | P1 |

### 7.8. Nhu yếu phẩm (quản trị)

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `GET /supply-items` · `POST` · `PUT /:id` | SCR-71 | ❌ | **P0** |
| `GET /supply-orders` · `/:id` | SCR-71 | ❌ | **P0** |
| `PATCH /supply-orders/:id/deliver` | SCR-71 | ❌ | **P0** |
| `PATCH /supply-orders/:id/cancel` | SCR-71 | ❌ | **P0** |

### 7.9. Cổng sinh viên

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `GET /portal/profile` | SCR-61, 62, 69 | ❌ | **P0** |
| `GET /portal/my-residence` | SCR-61, 63, 66, 69 | ❌ | **P0** |
| `GET /portal/my-contracts` | SCR-63 | ❌ | **P0** |
| `GET /portal/my-invoices` · `/:id` | SCR-61, 64 | ❌ | **P0** |
| `GET /portal/my-payments` *(+`?transactionRef=`)* | SCR-65 | ❌ | **P0** |
| `GET /portal/my-requests` · `POST` · `DELETE /:id` | SCR-66 | ⚠️ đang dùng chung router với `/api/requests` (lộ cả route duyệt) | P0 |
| `GET /portal/my-applications` · `POST` · `DELETE /:id` | SCR-61, 62 | ❌ | **P0** |
| `GET /portal/supply-items` | SCR-61, 67 | ❌ | **P0** |
| `GET /portal/my-supply-orders` · `POST` · `PATCH /:id/cancel` | SCR-67, 68 | ❌ | **P0** |

### 7.10. Dashboard

| Method · Endpoint | Màn FE | Backend | Ưu tiên |
|---|---|---|---|
| `GET /dashboard/summary` | SCR-10 | ⚠️ tên trường khác, tỷ lệ lấp đầy tính sai | P0 |
| `GET /dashboard/occupancy` | SCR-10 | ⚠️ tỷ lệ tính sai, `gender` thừa | P0 |

### 7.11. Tổng kết số lượng

| Trạng thái | Số endpoint | Ghi chú |
|---|---|---|
| ✅ Dùng được ngay | 10 | Đăng nhập/đổi mật khẩu, sinh viên, lưu trú, webhook VNPay |
| ⚠️ Có nhưng lệch | 41 | Phần lớn chỉ cần đổi tên trường / bổ sung trường, không phải viết lại |
| ❌ Chưa có | 34 | Loại phòng (3), đơn đăng ký (5), tài khoản (4), phòng trống + xem trước hóa đơn (2), nhu yếu phẩm (7), cổng sinh viên (13) |
| 🗑️ Nên bỏ | 1 | `PATCH /residencies/:id/close` |
| **Tổng** | **86** | Trong đó 82 endpoint frontend gọi trực tiếp |

**34 endpoint còn thiếu chiếm 11/31 màn** (Loại phòng, Đơn đăng ký, Tài khoản, Nhu yếu phẩm và toàn bộ 8 màn cổng sinh viên trừ Yêu cầu của tôi) — đây là phần quyết định demo có chạy đủ luồng hay không.

> Frontend đã chạy được phần **xem** với backend thật ở: Đăng nhập, Dashboard, Tòa nhà, Loại phí, Chỉ số điện nước, Hóa đơn (danh sách + chi tiết), Thanh toán. Các màn còn lại đang chạy bằng dữ liệu giả, bật lại bằng một biến môi trường khi backend sẵn sàng.

---

## 8. Cần chốt giữa hai bên

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
| 1.11 | 16/09/2026 | FE Lead | Cập nhật mục 0, 1 theo hiện trạng FE đã xong. Viết lại **mục 5** theo luồng nghiệp vụ (FE đã xong 31/31 màn). Thêm **mục 6** (đợt 2: phần thêm sau bản v1.2.8) và **mục 7** (bảng đối chiếu toàn bộ 82 endpoint frontend gọi kèm hiện trạng backend) |
| 1.10 | 16/09/2026 | FE Lead | Đăng ký tài khoản sinh viên (3.1): `register` phải liên kết hồ sơ có sẵn (FR-80/81), backend đang tạo hồ sơ mới. **FE đã xong toàn bộ 31 màn** |
| 1.9 | 16/09/2026 | FE Lead | Cổng SV (3.10): mua sắm + đơn hàng của tôi (SCR-67/68) đã xong |
| 1.8 | 16/09/2026 | FE Lead | Cổng SV (3.10): hóa đơn + kết quả thanh toán (SCR-64/65) đã xong, cần `my-invoices`, `my-payments?transactionRef=` |
| 1.7 | 16/09/2026 | FE Lead | Cổng SV (3.10): `profile` và `my-contracts` cho 2 màn SCR-63, SCR-69 đã xong |
| 1.6 | 16/09/2026 | FE Lead | Nhu yếu phẩm (3.14): định dạng cho màn quản trị SCR-71 đã làm xong |
| 1.5 | 16/09/2026 | FE Lead | Lịch sử thanh toán (3.13): danh sách có `summary`, lọc, đối soát giao dịch treo |
| 1.4 | 15/09/2026 | FE Lead | Chi tiết hóa đơn (3.12) + ghi nhận thanh toán tại quầy (3.13): `payments[]` trong chi tiết, `bankReference`, `paidAt`, `INVOICE_CANCELLED` |
| 1.3 | 15/09/2026 | FE Lead | Hóa đơn (3.12): xem trước lập hàng loạt, danh sách + `summary`, hóa đơn lẻ, luật hủy |
| 1.2 | 15/09/2026 | FE Lead | Chỉ số điện nước (3.12): định dạng danh sách cho màn SCR-51 |
| 1.1 | 15/09/2026 | FE Lead | Phí (3.12): cập nhật dữ liệu loại phí đang có trên DB chung, thêm yêu cầu cho màn SCR-82 (`includeInactive`, `isSystem`, `FEE_TYPE_REQUIRED`) |
| 1.0 | 15/09/2026 | FE Lead | Bản đầu — đối chiếu `API.md` v1.2.8 với `BE_QLKTX` commit `ab7db8c` |
