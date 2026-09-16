# API Reference

**Project:** Dormitory Management System
**Version:** 1.2
**Base URL:** `/api`
**Auth:** JWT Bearer token (`Authorization: Bearer <token>`)
**Audience:** Developers (new hires + AI coding assistants)

> Endpoints are grouped by feature module, matching `modules/<feature>/` in `ARCHITECTURE.md`. Each module's routes are mounted at `/api/<feature>` in `app.js`.
>
> ⚠️ **This is the contract between frontend and backend.** Any change must be agreed and written here *before* code is written on either side.

---

## 1. Conventions

### 1.1 Response envelope

```json
// success
{ "code": "OK", "message": "Success", "data": { } }

// error
{ "code": "VALIDATION_ERROR", "message": "roomId is required", "data": null }
```

- HTTP status code reflects the outcome (`200/201` success, `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict, `422` business-rule violation, `500` server error).
- `code` is a stable machine-readable string (used by the frontend for error-specific UI), `message` is human-readable **in Vietnamese** (it is shown to the user as-is).

**Field-level validation errors** put the details in `data` so the frontend can attach them to the right input:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ",
  "data": { "errors": [ { "field": "studentCode", "message": "Mã số sinh viên đã tồn tại" } ] }
}
```

### 1.2 Pagination

List endpoints accept `?page=1&limit=20&sort=-createdAt` and respond with:

```json
{ "code": "OK", "message": "Success",
  "data": { "items": [ ], "total": 132, "page": 1, "limit": 20 } }
```

### 1.3 Roles legend

| Role | Access |
|---|---|
| `admin` | full access |
| `staff` | manage students/rooms/contracts/payments, cannot manage users |
| `student` | own-data only (self-service) |
| `viewer` | read-only on reports/occupancy |

Each endpoint below lists the roles allowed to call it. **Every endpoint re-checks the role server-side** — frontend guards are UX only.

### 1.4 Own-data rule for `student`

For any endpoint a `student` may call, the backend derives the student identity from the **JWT**, never from a query or body parameter. A student passing someone else's id gets `403 FORBIDDEN`, not that person's data.

---

## 2. Auth — `modules/auth`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/api/auth/register` | public | Student self-registration only (`role` forced to `student` server-side) |
| POST | `/api/auth/login` | public | Returns JWT + user profile |
| POST | `/api/auth/logout` | authenticated | Client clears the token |
| GET | `/api/auth/me` | authenticated | Current user profile |
| PATCH | `/api/auth/change-password` | authenticated | Change own password |
| POST | `/api/users/:id/reset-password` | admin, staff | Issue a one-time temporary password (`FR-09`). Staff may not reset an `admin` account |
| GET | `/api/users` | admin | Account list — `?search=&role=&isActive=true\|false&page=&limit=` *(v1.2.6)* |
| POST | `/api/users` | admin | Create an account — `{ email, fullName, role, studentId? }`; returns a one-time temporary password *(v1.2.6)* |
| PUT | `/api/users/:id` | admin | Update `{ email, fullName, role }` *(v1.2.6)* |
| PATCH | `/api/users/:id/status` | admin | Lock / unlock — `{ isActive }` *(v1.2.6)* |

**POST `/api/auth/login`**
```json
// request
{ "email": "staff1@dorm.local", "password": "••••••••" }
// response
{ "code": "OK", "message": "Đăng nhập thành công",
  "data": { "token": "eyJhbGciOi...", "expiresIn": 604800,
            "user": { "id": "665f..", "email": "staff1@dorm.local", "fullName": "Lê Thị Nhân Viên",
                      "role": "staff", "studentId": null, "mustChangePassword": false } } }
```
> v1 issues **one** JWT valid for 7 days. There is no refresh token — when it expires the user logs in again.

**Login errors**
```json
{ "code": "INVALID_CREDENTIALS", "message": "Email hoặc mật khẩu không chính xác", "data": null }                 // 401 — same message for unknown email and wrong password
{ "code": "ACCOUNT_LOCKED", "message": "Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ ban quản lý", "data": null } // 403
{ "code": "VALIDATION_ERROR", "message": "Dữ liệu không hợp lệ", "data": { "errors": [ { "field": "email", "message": "Email không đúng định dạng" } ] } } // 400
```

**PATCH `/api/auth/change-password`**
```json
// request
{ "oldPassword": "Ktx7Rm2qPz", "newPassword": "Moi12345" }
// response
{ "code": "OK", "message": "Đổi mật khẩu thành công", "data": null }
```
```json
{ "code": "INVALID_CURRENT_PASSWORD", "message": "Mật khẩu hiện tại không chính xác", "data": null } // 400
```
> Success sets `mustChangePassword: false`. While it is `true` the frontend blocks every other screen (BR-85); the backend does not, so this is UX only.

**POST `/api/users/:id/reset-password`**
```json
{ "code": "OK", "message": "Đã đặt lại mật khẩu",
  "data": { "temporaryPassword": "Ktx7Rm2qPz", "mustChangePassword": true } }
```
> `temporaryPassword` is returned **once** and must never be written to a log. Staff resetting an admin → `403 FORBIDDEN` (BR-84); resetting your own account → `422 CANNOT_MODIFY_SELF` (use change-password).

### 2.1 Account management *(v1.2.6 — SCR-81, FR-06)*

**GET `/api/users`** — admin only
```json
{ "code": "OK", "message": "Success",
  "data": { "items": [
      { "id": "665f..", "email": "sv001@dorm.local", "fullName": "Nguyễn Văn An", "role": "student",
        "isActive": true, "mustChangePassword": false, "lastLoginAt": "2026-09-15T08:00:00Z", "createdAt": "2026-08-01T01:00:00Z",
        "student": { "id": "665f1a..", "studentCode": "SV2026001", "fullName": "Nguyễn Văn An" } }
    ], "total": 12, "page": 1, "limit": 20,
    "summary": { "all": 12, "admin": 2, "staff": 3, "viewer": 1, "student": 6, "locked": 1 } } }
```
> Sorted admin → staff → viewer → student, then by name. `search` matches email, full name and student code. `summary` ignores filters. Never returns `passwordHash`.

**POST `/api/users`**
```json
// request — role 'student' requires studentId (fullName is taken from the Student profile); other roles require fullName
{ "email": "nhanvien3@dorm.local", "fullName": "Vũ Thị Nhân Viên Mới", "role": "staff" }
// response 201
{ "code": "OK", "message": "Đã tạo tài khoản",
  "data": { "user": { "id": "..", "email": "nhanvien3@dorm.local", "role": "staff", "isActive": true, "mustChangePassword": true },
            "temporaryPassword": "t8rtmpXTvN" } }
```
> The account starts with `mustChangePassword: true`; the temporary password follows BR-85 and is shown once. Field errors (`VALIDATION_ERROR`): `email` (format / already used — BR-80), `fullName`, `role`, `studentId` (missing / *"Sinh viên này đã có tài khoản"* — BR-82).

**PUT `/api/users/:id`** — `{ email, fullName, role }`. A `student` account's `fullName` follows its Student profile and its role cannot change to or from `student` (field error on `role`).

**PATCH `/api/users/:id/status`** — `{ "isActive": false }` → *"Đã khóa tài khoản"*. A locked account gets `403 ACCOUNT_LOCKED` at login; its data is kept.

Account errors:
```json
{ "code": "CANNOT_MODIFY_SELF", "message": "Không thể tự khóa tài khoản của chính mình", "data": null }            // 422 — also for changing your own role
{ "code": "LAST_ACTIVE_ADMIN", "message": "Không thể khóa quản trị viên cuối cùng đang hoạt động", "data": null }   // 422 — BR-83, also for demoting it
```

**Student list** (`GET /api/students`) items also carry `hasAccount` so the create form can disable students that already have an account.

---

## 3. Students — `modules/students`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/students` | admin, staff, viewer | List/search — `?search=Nguyen&status=active&gender=male&page=1&limit=20` |
| GET | `/api/students/:id` | admin, staff, viewer | Get one, with current residency + outstanding debt |
| POST | `/api/students` | admin, staff | Create student profile |
| PUT | `/api/students/:id` | admin, staff | Update profile |
| PATCH | `/api/students/:id/deactivate` | admin, staff | Soft-delete (sets `status: inactive`) |

**POST `/api/students`**
```json
// request
{ "fullName": "Nguyen Van A", "studentCode": "SV2026001", "gender": "male",
  "dob": "2005-03-14", "phone": "0901234567", "className": "CNTT2026A",
  "emergencyContact": { "name": "Nguyen Van B", "phone": "0909876543", "relationship": "Father" } }
// response 201
{ "code": "OK", "message": "Thêm sinh viên thành công",
  "data": { "id": "665f1a...", "studentCode": "SV2026001", "status": "active" } }
```

**PATCH `/api/students/:id/deactivate` — blocked cases**
```json
{ "code": "STUDENT_HAS_ACTIVE_CONTRACT", "message": "Sinh viên đang có hợp đồng hiệu lực", "data": null } // 422
{ "code": "STUDENT_HAS_DEBT", "message": "Sinh viên còn công nợ chưa thanh toán", "data": null }         // 422
```

---

## 4. Rooms, Room Types & Beds — `modules/rooms`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/buildings` | admin, staff, viewer, student | List buildings with occupancy stats — active only by default; `?includeInactive=true` (admin, staff, viewer) adds inactive ones for the Buildings screen |
| POST | `/api/buildings` | admin, staff | Create building — `{ code, name, address?, description? }`; `code` uppercased, unique (BR-01) |
| PUT | `/api/buildings/:id` | admin, staff | Update `{ name, address, description, isActive }` — `code` cannot change; no delete endpoint (BR-07) |
| GET | `/api/room-types` | admin, staff, viewer, student | List — `?tier=&isActive=true&withAvailability=true` *(v1.2)* |
| POST | `/api/room-types` | admin | Create room type *(v1.2)* |
| PUT | `/api/room-types/:id` | admin | Update price, deposit, amenities; `tier`/`capacity` locked once used *(v1.2)* |
| GET | `/api/rooms` | admin, staff, viewer | List — `?buildingId=&roomTypeId=&floor=&gender=&availability=has_slot\|full\|has_maintenance` |
| GET | `/api/rooms/available` | admin, staff, student | Rooms with at least one free bed — `?roomTypeId=&buildingId=&gender=` (`gender` honoured for admin/staff only) *(v1.2)* |
| GET | `/api/rooms/:id` | admin, staff, viewer | Room detail with every bed and its current occupant (floor-map drawer) |
| POST | `/api/rooms` | admin, staff | Create room (**`roomTypeId` and `gender` required**) — beds are generated automatically |
| PUT | `/api/rooms/:id` | admin, staff | Update number, floor, status; `roomTypeId`/`gender` only while the room is empty |
| PATCH | `/api/beds/:id/status` | admin, staff | Set `maintenance` ⇄ `available` — `{ status, note? }`; `note` is kept only while in maintenance |

> **Removed in v1.2:** `POST /api/rooms/:roomId/beds`, `POST /api/rooms/:roomId/beds/generate`, `GET /api/rooms/:roomId/beds` (use `GET /api/rooms/:id`) and `GET /api/beds/available`. Beds are created by the system and never picked by a person.

**GET `/api/buildings?includeInactive=true`** *(v1.2.7)*
```json
{ "code": "OK", "message": "Success",
  "data": [
    { "id": "665e0a...", "code": "A", "name": "Tòa A", "address": "Khu KTX số 1", "description": "", "isActive": true,
      "stats": { "totalRooms": 10, "totalBeds": 49, "occupiedBeds": 35, "availableBeds": 13, "maintenanceBeds": 1 } }
  ] }
```
> Plain array sorted by `code`. `stats` counts only rooms that are not `inactive`. Setting `isActive: false` on a building that still has occupied beds → `422 BUILDING_HAS_OCCUPANTS`. Duplicate code → `409 DUPLICATE_ENTRY` with a field error on `code`.
>
> **Backend status (15/09/2026):** list ignores `includeInactive` (always active only, so an inactive building can never be reactivated from the UI), `stats` has no `maintenanceBeds`, duplicate code returns `409 BUILDING_CODE_ALREADY_EXISTS` (frontend accepts both codes), and deactivating a building with residents is not blocked.

**GET `/api/room-types?withAvailability=true`**
```json
{ "code": "OK", "message": "Success",
  "data": { "items": [
    { "id": "665e1b...", "tier": "standard", "capacity": 6, "name": "Tiêu chuẩn · 6 người",
      "pricePerMonth": 320000, "depositAmount": 500000,
      "amenities": ["Giường tầng", "Tủ cá nhân", "Quạt trần", "Bàn học chung"],
      "includedSupplies": [],
      "roomCount": 10, "availableSlots": 9, "isActive": true },
    { "id": "665e1c...", "tier": "premium", "capacity": 4, "name": "Chất lượng cao · 4 người",
      "pricePerMonth": 950000, "depositAmount": 1000000,
      "amenities": ["Giường tầng", "Tủ cá nhân", "Điều hòa", "Bình nóng lạnh", "WC riêng", "Bàn học riêng"],
      "includedSupplies": ["Đệm mút 90x190cm"],
      "roomCount": 6, "availableSlots": 2, "isActive": true }
  ], "total": 6, "page": 1, "limit": 20 } }
```
> `includedSupplies` = names of `SupplyItem`s issued free with this type. `roomCount`/`availableSlots` appear only with `withAvailability=true`; for a `student` they count **only rooms matching the student's gender**.

**GET `/api/rooms/available?roomTypeId=665e1b...`** — student step "Chọn phòng"
```json
{ "code": "OK", "message": "Success",
  "data": { "items": [
    { "id": "665f2a...", "roomNumber": "203", "floor": 2, "buildingName": "Tòa B",
      "gender": "female", "capacity": 6, "occupied": 4, "availableSlots": 2 }
  ], "total": 3, "page": 1, "limit": 20 } }
```
> For a `student` the gender filter is taken from their own profile via the JWT — any `gender` query parameter is ignored. Admin/staff pass `gender` explicitly (SCR-31 lists replacement rooms of the applicant's gender). Each item also carries `buildingCode` and `roomTypeId`.

**GET `/api/rooms/:id`** — floor-map detail panel
```json
{ "code": "OK", "message": "Success",
  "data": {
    "id": "665f2a...", "roomNumber": "203", "floor": 2, "buildingName": "Tòa B", "gender": "female", "status": "active",
    "roomTypeId": "665e1b...", "roomTypeName": "Tiêu chuẩn · 6 người", "tier": "standard", "pricePerMonth": 320000,
    "capacity": 6, "occupied": 4, "availableSlots": 1, "maintenanceBeds": 1,
    "amenities": ["Giường tầng", "Tủ cá nhân", "Quạt trần", "Bàn học chung"], "includedSupplies": [],
    "beds": [
      { "id": "6660b1...", "bedNumber": 1, "bedCode": "B203-01", "status": "occupied", "note": null,
        "occupant": { "studentCode": "SV2024003", "studentName": "Nguyễn Thị Mai", "className": "K64 QTKD" } },
      { "id": "6660b5...", "bedNumber": 5, "bedCode": "B203-05", "status": "available", "note": null, "occupant": null },
      { "id": "6660b6...", "bedNumber": 6, "bedCode": "B203-06", "status": "maintenance", "note": "Khung giường hỏng", "occupant": null }
    ]
  } }
```
> Occupant exposes name, student code and class only — never phone or emergency contact (`07` §5.6).

**POST `/api/rooms`**
```json
// request
{ "buildingId": "665f0a...", "roomNumber": "203", "floor": 2, "gender": "female", "roomTypeId": "665e1b..." }
// response 201
{ "code": "OK", "message": "Thêm phòng thành công",
  "data": { "id": "665f2a...", "roomNumber": "203", "capacity": 6, "bedsCreated": 6 } }
```
> No price in the request — it belongs to the room type. `capacity` is copied from the room type.

**Error cases**
```json
{ "code": "ROOM_TYPE_IN_USE", "message": "Loại phòng đang được sử dụng, không thể đổi hạng hoặc sức chứa", "data": null } // 422
{ "code": "ROOM_HAS_OCCUPANTS", "message": "Phòng đang có người ở, không thể đổi loại phòng hoặc giới tính", "data": null } // 422
{ "code": "BED_OCCUPIED", "message": "Giường đang có người ở, không thể chuyển bảo trì", "data": null }                     // 422
```

---

## 5. Residencies & Applications — `modules/residencies`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/residencies` | admin, staff, viewer | List — `?studentId=&roomId=&status=active` |
| GET | `/api/residencies/:id` | admin, staff, viewer, student (own) | Get one |
| PATCH | `/api/residencies/:id/close` | admin, staff | Close residency — flips `Bed.status → available` |

> **v1.2:** there is no `POST /api/residencies`. A residency is created only by approving an application (§5.1).

### 5.1 Applications (Đơn đăng ký) *(v1.2)*

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/applications` | admin, staff, viewer | Queue — `?status=pending&roomTypeId=&search=&page=&limit=`. `pending` oldest first; `approved`/`rejected` most recently reviewed first. `search` matches application code, student code, student name, requested room number. Response adds `summary: { pending, approved, rejected }` (counts ignore the `status` filter) |
| GET | `/api/applications/:id` | admin, staff, viewer | Detail: student + debt, requested room with its beds, estimated first invoices |
| POST | `/api/applications` | admin, staff | File an application for a walk-in student — `{ studentId, roomId, startDate, endDate, note }` |
| PATCH | `/api/applications/:id/approve` | admin, staff | Approve — `{ roomId? }`. Assigns a bed **automatically**, creates Residency + Contract + two invoices |
| PATCH | `/api/applications/:id/reject` | admin, staff | Reject — `{ reviewNote }` required (min 10 characters) |

Students submit and cancel through the portal (§10).

**GET `/api/applications/:id`**
```json
{ "code": "OK", "message": "Success",
  "data": {
    "id": "6660aa...", "applicationCode": "DK-2026-00043", "status": "pending",
    "createdAt": "2026-08-27T14:02:00Z", "note": "Em muốn ở gần bạn cùng lớp",
    "student": { "id": "665f1a...", "studentCode": "SV2024001", "fullName": "Trần Thị Bích",
                 "gender": "female", "className": "CNTT2024A", "phone": "0912345678", "totalDebt": 0 },
    "roomType": { "id": "665e1b...", "name": "Tiêu chuẩn · 6 người", "tier": "standard", "capacity": 6,
                  "pricePerMonth": 320000, "depositAmount": 500000 },
    "requestedRoom": { "id": "665f2a...", "roomNumber": "203", "buildingName": "Tòa B", "buildingCode": "B", "floor": 2, "availableSlots": 2,
                       "beds": [ { "bedNumber": 1, "status": "occupied", "occupantName": "Nguyễn Thị Mai" },
                                 { "bedNumber": 3, "status": "available", "occupantName": null } ] },
    "startDate": "2026-09-01", "endDate": "2027-06-30",
    "estimatedInvoices": { "deposit": 500000, "firstMonth": 320000, "total": 820000 },
    "reviewedAt": null, "reviewNote": null, "assigned": null, "contractCode": null
  } }
```
> Once reviewed: `reviewedAt` is set; `rejected` fills `reviewNote`; `approved` fills
> `"assigned": { "roomId", "roomNumber", "buildingName", "buildingCode", "bedCode": "B205-04" }` and `"contractCode"`.
> List items carry the same shape (without `requestedRoom.beds`) so the queue can show the assigned room.

**PATCH `/api/applications/:id/approve`**
```json
// request — omit roomId to use the room the student picked
{ "roomId": "665f2b..." }
// response
{ "code": "OK", "message": "Đã duyệt và xếp phòng",
  "data": {
    "application": { "id": "6660aa...", "status": "approved" },
    "assigned": { "roomNumber": "205", "buildingName": "Tòa B", "buildingCode": "B", "bedCode": "B205-04" },
    "contract": { "id": "665f4d...", "contractCode": "HD-2026-00087", "status": "active",
                  "monthlyPrice": 320000, "depositAmount": 500000 },
    "invoices": [
      { "id": "665f5a...", "invoiceCode": "INV-202609-00101", "type": "deposit",
        "billingPeriod": null, "totalAmount": 500000, "dueDate": "2026-09-08" },
      { "id": "665f5b...", "invoiceCode": "INV-202609-00102", "type": "monthly",
        "billingPeriod": "2026-09", "totalAmount": 320000, "dueDate": "2026-09-08" }
    ]
  } }
```
> ⚠️ Returns an **array of two** invoices, not one. The deposit must stay a separate invoice — merging it into the monthly invoice causes that student's electricity and water for the period to never be billed (`DATA-SCHEMA.md` §3.10).
>
> ⚠️ **No bed id is ever accepted.** The system takes the lowest-numbered free bed of the room atomically (`DATA-SCHEMA.md` §3.5).

**Error cases**
```json
{ "code": "ROOM_FULL", "message": "Phòng B203 vừa hết chỗ. Vui lòng chọn phòng khác cùng loại", "data": null }         // 409
{ "code": "ROOM_TYPE_MISMATCH", "message": "Chỉ được đổi sang phòng cùng loại với đơn đăng ký", "data": null }          // 422
{ "code": "GENDER_MISMATCH", "message": "Phòng này chỉ dành cho sinh viên nữ", "data": null }                          // 422
{ "code": "APPLICATION_NOT_PENDING", "message": "Đơn đăng ký đã được xử lý", "data": null }                             // 422
{ "code": "STUDENT_HAS_ACTIVE_CONTRACT", "message": "Sinh viên đã có hợp đồng đang hiệu lực", "data": null }           // 422
{ "code": "DUPLICATE_PENDING_APPLICATION", "message": "Sinh viên đã có một đơn đăng ký đang chờ duyệt", "data": null } // 409
```
> `GENDER_MISMATCH` *(PRD §2.9 A1)* compares `Student.gender` with `Room.gender`, **not** with the building. It is checked on submit **and** again on approval, because staff may switch rooms.
>
> 💡 On `ROOM_FULL` the frontend should reload the room dropdown and keep the application open — the approval can simply be retried with another room of the same type.

---

## 6. Contracts — `modules/contracts`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/contracts` | admin, staff, viewer | List — `?status=active\|expired\|terminated&buildingId=&roomTypeId=&search=&expiringInDays=30&page=&limit=`. `search` matches contract code, student code/name, bed code. With `expiringInDays` the soonest end date comes first; otherwise the latest start date. Response adds `summary: { all, active, expiring, expired, terminated }` (counts ignore filters) |
| GET | `/api/contracts/:id` | admin, staff, viewer, student (own) | Get one, with invoices and history |
| PUT | `/api/contracts/:id` | admin, staff | Update `terms` only — dates change through renewal requests (§9) |
| PATCH | `/api/contracts/:id/terminate` | admin, staff | `active → terminated` — `{ reason, terminationDate }`; cascades supply-order cancel + residency close + bed release + deposit settlement |
| GET | `/api/contracts/expiring` | admin, staff, viewer | Contracts expiring within N days — `?days=30` |

**List item** — every contract row carries, besides the stored fields: `buildingId`, `buildingCode`, `tier`, `isExpiring` (BR-29) and `totalDebt` (the student's current unpaid total).

**GET `/api/contracts/:id`** — adds to the list item:
```json
{ "student": { "id": "665f1a...", "studentCode": "SV2026001", "fullName": "Nguyễn Văn An", "gender": "male", "className": "CNTT2026A", "phone": "0912000000" },
  "depositStatus": "paid",
  "invoices": [ { "id": "...", "invoiceCode": "INV-202609-00001", "type": "deposit", "billingPeriod": null, "totalAmount": 500000, "remainingAmount": 0, "status": "paid", "issueDate": "2026-08-30" } ],
  "pendingRequests": [ { "id": "...", "type": "renewal", "createdAt": "2026-11-01T08:00:00+07:00", "requestedEndDate": "2027-12-31" } ],
  "unpaidSupplyOrders": 1,
  "history": [ { "at": "2026-08-30T10:00:00+07:00", "type": "application_approved", "title": "Duyệt đơn, tạo hợp đồng", "description": "Xếp giường A101-01 · ..." } ] }
```
> `history` is newest first. `type` ∈ `application_submitted`, `application_approved`, `request_renewal`, `request_checkout`, `terminated`, `expired`. Terminated contracts also expose `terminatedAt` and `terminationReason`.

**PATCH `/api/contracts/:id/terminate`**
```json
// request — reason min 10 characters; terminationDate within [startDate, endDate], defaults to today
{ "reason": "Sinh viên vi phạm nội quy nhiều lần, đã lập biên bản", "terminationDate": "2026-09-15" }
// response
{ "code": "OK", "message": "Đã chấm dứt hợp đồng",
  "data": {
    "contract": { "id": "665f4d...", "contractCode": "HD-2026-00001", "status": "terminated", "terminatedAt": "2026-09-15" },
    "settlement": { "outstandingDebt": 566000, "depositAmount": 500000, "refundAmount": 0, "studentStillOwes": 66000, "cancelledSupplyOrders": 1 }
  } }
```
Errors: `CONTRACT_NOT_ACTIVE` (422), `VALIDATION_ERROR` with field errors on `reason` / `terminationDate`.
> Same settlement shape as checkout approval (§9). The rent of the unfinished period is prorated by days actually stayed (BR-31) **before** `outstandingDebt` is computed; unpaid supply orders are cancelled first (BR-97). Pending renewal/checkout requests of the contract should be closed by the backend — the UI already hides them once the contract is no longer `active`.

> **v1.2:** `POST /api/contracts` and `PATCH /api/contracts/:id/activate` were removed. Contracts are created already `active` by application approval (§5.1), with `monthlyPrice` and `depositAmount` frozen from the room type. There is no `pending` contract status any more.

---

## 7. Fees, Utility Readings & Invoices — `modules/fees`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/fee-types` | admin, staff, viewer | List fee types |
| POST | `/api/fee-types` | admin | Create fee type |
| PUT | `/api/fee-types/:id` | admin | Update unit price |
| GET | `/api/utility-readings` | admin, staff, viewer | List — `?billingPeriod=2026-10&buildingId=` |
| POST | `/api/utility-readings` | admin, staff | Enter meter readings for one room/period |
| PUT | `/api/utility-readings/:id` | admin, staff | Edit — rejected once `isInvoiced: true` |
| POST | `/api/invoices/generate` | admin, staff | Bulk-generate invoices for a billing period |
| GET | `/api/invoices` | admin, staff, viewer | List — `?studentId=&status=&billingPeriod=&type=deposit\|monthly\|settlement\|supplies\|other` |
| GET | `/api/invoices/:id` | admin, staff, viewer, student (own) | Get one, with line items and payments |
| POST | `/api/invoices` | admin, staff | Create a one-off invoice manually |
| PATCH | `/api/invoices/:id/cancel` | admin, staff | Cancel — only if no successful payment exists |
| GET | `/api/invoices/overdue` | admin, staff, viewer | Overdue invoices (dashboard list) |

**POST `/api/utility-readings`** *(PRD §2.9 A2)*
```json
// request
{ "roomId": "665f2a...", "billingPeriod": "2026-10",
  "electricityStart": 1250, "electricityEnd": 1610,
  "waterStart": 85, "waterEnd": 133 }
// response 201 — unit prices are copied from FeeType and frozen on the record
{ "code": "OK", "message": "Lưu chỉ số thành công",
  "data": { "id": "665f8a...", "electricityConsumption": 360, "electricityAmount": 900000,
            "waterConsumption": 48, "waterAmount": 576000, "isInvoiced": false } }
```
```json
{ "code": "INVALID_METER_READING", "message": "Chỉ số cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ", "data": null } // 422
{ "code": "READING_ALREADY_INVOICED", "message": "Kỳ này đã lập hóa đơn, không thể sửa chỉ số", "data": null }      // 422
```

**POST `/api/invoices/generate`**
```json
// request
{ "billingPeriod": "2026-10", "buildingIds": ["665f0a..."], "dueDate": "2026-11-10" }
// response
{ "code": "OK", "message": "Đã lập 118 hóa đơn cho kỳ 10/2026",
  "data": {
    "created": 118,
    "updated": 3,
    "totalAmount": 76228000,
    "skipped": [
      { "roomId": "665f2b...", "roomNumber": "405", "reason": "Chưa nhập chỉ số điện nước" },
      { "roomId": "665f2c...", "roomNumber": "406", "reason": "Không có sinh viên đang ở" }
    ]
  } }
```
> `updated` counts students who already had a `monthly` invoice for the period (contract activated mid-period) and had electricity/water line items **added** to it. They are not skipped — skipping them loses the utility charge.

---

## 8. Payments — `modules/payments`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/payments` | admin, staff, viewer | List — `?invoiceId=&studentId=&method=&status=` |
| POST | `/api/payments/offline` | admin, staff | Record manual cash/bank-transfer payment |
| POST | `/api/payments/online/checkout` | student | Start a VNPay/ZaloPay session — returns redirect URL / QR |
| POST | `/api/payments/webhook/vnpay` | public (gateway signed) | VNPay callback — verifies signature, updates `Payment` + `Invoice` |
| POST | `/api/payments/webhook/zalopay` | public (gateway signed) | ZaloPay callback — same as above |
| POST | `/api/payments/:id/reconcile` | admin, staff | Re-query the gateway for a stuck `pending` transaction |

**POST `/api/payments/online/checkout`**
```json
// request
{ "invoiceId": "665f5e...", "gateway": "vnpay", "amount": 246000 }
// response
{ "code": "OK", "message": "Success",
  "data": { "paymentId": "665f6f...", "transactionRef": "PAY20261108DEF456",
            "redirectUrl": "https://sandbox.vnpayment.vn/..." } }
```

**POST `/api/payments/webhook/vnpay`** (called by the gateway, not the frontend)
```json
// gateway payload (example shape)
{ "vnp_TxnRef": "PAY20261108DEF456", "vnp_ResponseCode": "00", "vnp_Amount": "24600000", "vnp_SecureHash": "..." }
```

| Situation | Handler behaviour | Rule |
|---|---|---|
| Signature valid, `vnp_ResponseCode = "00"` | `Payment.status = 'success'`, recompute `Invoice.paidAmount` and `status` | — |
| Signature invalid | Log a security warning, change **nothing**, return `GATEWAY_SIGNATURE_INVALID` | never trust unsigned input |
| Payment already `success` | Acknowledge, change nothing — **do not** credit twice | idempotency |
| Amount mismatch | `Payment.status` unchanged, flag for manual reconciliation | — |

> When a payment makes an invoice with `type: 'supplies'` fully `paid` — online **or** offline — the service moves the linked supply order to `ready` (`DATA-SCHEMA.md` §3.16). *(v1.2)*

> Signature verification and idempotency live in `payment.service.js`; controllers only parse and delegate. Webhook routes are excluded from JWT auth but **must** pass gateway signature validation.

> 💡 **Local development:** the gateway cannot reach `localhost`, so the webhook will not fire on your machine. Test the three security cases above by calling the webhook endpoint directly from Postman — no tunnelling tool needed. Use `POST /api/payments/:id/reconcile` for transactions left `pending`.

---

## 9. Requests (Renewal/Checkout) — `modules/requests`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/requests` | admin, staff, viewer | Staff queue — `?status=pending&type=renewal&search=&page=&limit=`. Newest first (processed: most recently reviewed first). `search` matches student name/code, contract code, bed code, request code. Response adds `summary: { pending, approved, rejected, byType: { all, renewal, checkout } }` — `byType` counts within the requested `status` |
| GET | `/api/requests/:id` | admin, staff | Detail, including the student's outstanding debt |
| PATCH | `/api/requests/:id/approve` | admin, staff | Approve — cascades contract/residency/bed/deposit updates |
| PATCH | `/api/requests/:id/reject` | admin, staff | Reject — `{ reviewNote }` required (non-empty, BR-78) |

**List item** carries `requestCode` (`YC-YYYY-XXXXX`), `roomNumber`, `buildingName`, `buildingCode`, `contractEndDate` and `outstandingDebt` (unpaid supply orders excluded — see the note under approval). Viewers only get the list; the detail below is admin/staff.

**GET `/api/requests/:id`** — adds:
```json
{ "student": { "studentCode": "SV2026005", "fullName": "Hoàng Quốc Bảo", "gender": "male", "className": "CNTT2026B", "phone": "0912000548" },
  "contract": { "contractCode": "HD-2026-00005", "status": "active", "startDate": "2026-09-01", "endDate": "2027-06-30", "monthlyPrice": 320000, "depositAmount": 500000, "bedCode": "A101-03", "roomTypeName": "Tiêu chuẩn · 6 người" },
  "unpaidInvoices": [ { "invoiceCode": "INV-202610-00010", "type": "monthly", "billingPeriod": "2026-10", "dueDate": "2026-11-10", "remainingAmount": 578000 } ],
  "unpaidSupplyOrders": 0, "readySupplyOrders": 1,
  // pending checkout only
  "settlementPreview": { "checkoutDate": "2026-09-22", "depositAmount": 500000, "outstandingDebt": 578000,
                         "proratedRent": 234667, "proratedDays": 22, "daysInMonth": 30, "proratedPeriod": "2026-09",
                         "refundAmount": 0, "studentStillOwes": 312667, "cancelledSupplyOrders": 0 },
  "checklist": { "utilityPeriod": "2026-10", "utilityReadingRecorded": true, "readySupplyOrders": 1 },
  // pending renewal only
  "renewalPreview": { "currentEndDate": "2027-06-30", "requestedEndDate": "2027-12-31", "extraMonths": 6 } }
```
> `settlementPreview` uses the requested checkout date; the approval response returns the final numbers. Processed requests expose `reviewedAt` plus `renewal: { previousEndDate, newEndDate, extraMonths }` or the stored `settlement`.

**PATCH `/api/requests/:id/approve`** (type = `renewal`) — empty body; response `{ request, renewal: { previousEndDate, newEndDate, extraMonths }, settlement: null }`. Rejects `requestedEndDate <= endDate` (BR-72).

**PATCH `/api/requests/:id/approve`** (type = `checkout`)
```json
// request — refundMethod 'cash' | 'bank_transfer' (recorded on the refund Payment, BR-77)
{ "actualCheckoutDate": "2026-12-15", "refundMethod": "cash", "forceConfirm": true }
// response
{ "code": "OK", "message": "Duyệt trả phòng thành công",
  "data": {
    "request": { "id": "665f7a...", "status": "approved" },
    "settlement": {
      "outstandingDebt": 246000,
      "depositAmount": 500000,
      "refundAmount": 254000,
      "studentStillOwes": 0,
      "proratedRent": 0,
      "refundMethod": "cash",
      "settlementInvoiceId": "665f9c...",
      "cancelledSupplyOrders": 1
    }
  } }
// cascades: unpaid supply orders cancelled, Contract.status='terminated', Residency.status='closed', Bed.status='available'
```
```json
{ "code": "STUDENT_HAS_DEBT", "message": "Sinh viên còn nợ 246.000 đ. Xác nhận vẫn duyệt?", "data": { "outstandingDebt": 246000 } } // 422
```
> Returned when `forceConfirm` is absent/false and the student still owes money *(PRD §2.9 A3)*. Staff re-sends with `forceConfirm: true` to proceed.
>
> `outstandingDebt` is computed **after** cancelling the student's `pending_payment` supply orders — unreceived goods are never deducted from the deposit. *(v1.2)*

---

## 10. Student Portal — `modules/portal` (routes live in their feature modules)

All endpoints resolve the student from the **JWT**. Passing another student's id returns `403`.

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/portal/profile` | student | Own profile (read-only) |
| GET | `/api/portal/my-residence` | student | Current building/room/bed, room type with everything issued, contract + debt summary |
| GET | `/api/portal/my-contracts` | student | Current + historical contracts |
| GET | `/api/portal/my-invoices` | student | Own invoices — `?status=&type=` |
| GET | `/api/portal/my-invoices/:id` | student | Own invoice detail with line items |
| GET | `/api/portal/my-payments` | student | Own payment history |
| GET | `/api/portal/my-requests` | student | Own renewal/checkout requests — plain array, newest first, same fields as the staff list item (`requestCode`, `renewal`, `settlement`, `reviewNote`, `reviewedAt`) |
| POST | `/api/portal/my-requests` | student | Submit a renewal or checkout request |
| DELETE | `/api/portal/my-requests/:id` | student | Cancel own request while still `pending` — otherwise `422 REQUEST_NOT_PENDING` (BR-79) |
| GET | `/api/portal/my-applications` | student | Own applications *(v1.2)* |
| POST | `/api/portal/my-applications` | student | Submit an application — `{ roomId, startDate, endDate, note }` *(v1.2)* |
| DELETE | `/api/portal/my-applications/:id` | student | Cancel own application while `pending` *(v1.2)* |
| GET | `/api/portal/supply-items` | student | Shop: active items **not** issued with the student's room type, plus what is issued *(v1.2)* |
| GET | `/api/portal/my-supply-orders` | student | Own orders — `?status=` *(v1.2)* |
| POST | `/api/portal/my-supply-orders` | student | Place an order — creates a `supplies` invoice *(v1.2)* |
| PATCH | `/api/portal/my-supply-orders/:id/cancel` | student | Cancel own order while `pending_payment` *(v1.2)* |

**GET `/api/portal/my-residence`** *(v1.2.8)*
```json
// student without an active contract
{ "code": "OK", "message": "Success", "data": { "hasResidence": false } }
// student with an active contract
{ "code": "OK", "message": "Success",
  "data": {
    "hasResidence": true,
    "contract": { "id": "6660c1...", "contractCode": "HD-2026-00012", "status": "active",
                  "startDate": "2026-09-01", "endDate": "2027-06-30", "monthlyPrice": 320000, "depositAmount": 500000,
                  "bedCode": "B203-02", "roomId": "665f2a...", "roomNumber": "B203", "buildingName": "Tòa B",
                  "roomTypeId": "665e1b...", "roomTypeName": "Tiêu chuẩn · 6 người" },
    "roomType": { "id": "665e1b...", "name": "Tiêu chuẩn · 6 người", "tier": "standard", "pricePerMonth": 320000 },
    "includedInRoom": ["Giường tầng", "Tủ cá nhân", "Quạt trần", "Chăn", "Gối"],
    "roommates": [ { "studentCode": "SV2024015", "fullName": "Trần Thị B" } ],
    "debtSummary": { "totalDebt": 320000, "unpaidInvoiceCount": 1 }
  } }
```
> Never `404` — the portal home and header switch on `hasResidence`. `includedInRoom` = room type amenities + supply items issued with the room type. `roommates` exposes only name and student code (other students' data, BR-86).

**POST `/api/portal/my-requests`**
```json
{ "type": "renewal", "requestedEndDate": "2027-12-31", "reason": "Học tiếp kỳ sau" }
```
> Rules: `renewal` → `requestedEndDate` must be after the contract's current `endDate` (BR-72), `reason` optional. `checkout` → `requestedEndDate` between today and the contract `endDate`, `reason` required. Violations return `VALIDATION_ERROR` with field errors on `requestedEndDate` / `reason`.
```json
{ "code": "DUPLICATE_PENDING_REQUEST", "message": "Bạn đã có một yêu cầu cùng loại đang chờ xử lý", "data": null } // 409
{ "code": "CONTRACT_NOT_ACTIVE", "message": "Bạn chưa có hợp đồng đang hiệu lực", "data": null }                  // 422
```

**POST `/api/portal/my-applications`** *(v1.2)*
```json
// request — no studentId (taken from the JWT), no bedId (assigned on approval)
{ "roomId": "665f2a...", "startDate": "2026-09-01", "endDate": "2027-06-30", "note": "Em muốn ở gần bạn cùng lớp" }
// response 201
{ "code": "OK", "message": "Nộp đơn thành công. Ban quản lý sẽ duyệt trong 1–2 ngày làm việc",
  "data": { "id": "6660aa...", "applicationCode": "DK-2026-00043", "status": "pending",
            "estimatedInvoices": { "deposit": 500000, "firstMonth": 320000, "total": 820000 } } }
```
Errors: `ROOM_FULL`, `GENDER_MISMATCH`, `STUDENT_HAS_ACTIVE_CONTRACT`, `DUPLICATE_PENDING_APPLICATION` (see §5.1).

**GET `/api/portal/supply-items`** *(v1.2)*
```json
{ "code": "OK", "message": "Success",
  "data": {
    "roomType": { "name": "Tiêu chuẩn · 6 người" },
    "includedInRoom": ["Giường tầng", "Tủ cá nhân", "Quạt trần", "Bàn học chung"],
    "items": [
      { "id": "6661a1...", "name": "Vỏ đệm 90x190cm", "category": "bedding", "unit": "cái",
        "price": 120000, "imageUrl": "https://..." }
    ]
  } }
```
> Items issued free with the student's room type are **already filtered out** of `items`. A student without an active contract gets `422 CONTRACT_NOT_ACTIVE`.

**POST `/api/portal/my-supply-orders`** *(v1.2)*
```json
// request — quantities only; prices are never sent by the client
{ "items": [ { "supplyItemId": "6661a1...", "quantity": 1 }, { "supplyItemId": "6661a4...", "quantity": 1 } ] }
// response 201
{ "code": "OK", "message": "Đặt hàng thành công",
  "data": { "id": "6662b0...", "orderCode": "DH-2026-00012", "status": "pending_payment",
            "totalAmount": 160000,
            "invoice": { "id": "665f5c...", "invoiceCode": "INV-202609-00188", "type": "supplies",
                         "totalAmount": 160000, "dueDate": "2026-09-16" } } }
```
```json
{ "code": "SUPPLY_ALREADY_INCLUDED", "message": "Đệm mút 90x190cm đã được cấp sẵn trong phòng của bạn", "data": null } // 422
{ "code": "SUPPLY_ITEM_INACTIVE", "message": "Sản phẩm Ổ cắm điện đã ngừng bán", "data": null }                        // 422
{ "code": "ORDER_NOT_CANCELLABLE", "message": "Đơn hàng đã thanh toán, không thể hủy", "data": null }                    // 422
```
> The student pays the returned invoice through the normal payment flow (§8). There is no separate supplies checkout.

---

## 11. Supplies — `modules/supplies` *(v1.2)*

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/supply-items` | admin, staff, viewer | Catalog — `?category=&isActive=` |
| POST | `/api/supply-items` | admin, staff | Create item |
| PUT | `/api/supply-items/:id` | admin, staff | Update price, image URL, included room types, `isActive` |
| GET | `/api/supply-orders` | admin, staff, viewer | List — `?status=&search=&from=&to=`; response adds a `summary` block |
| GET | `/api/supply-orders/:id` | admin, staff, viewer | Detail |
| PATCH | `/api/supply-orders/:id/deliver` | admin, staff | `ready → delivered` |
| PATCH | `/api/supply-orders/:id/cancel` | admin, staff | `pending_payment → cancelled` — `{ cancelReason }` |

**GET `/api/supply-orders?status=ready`**
```json
{ "code": "OK", "message": "Success",
  "data": {
    "items": [
      { "id": "6662a9...", "orderCode": "DH-2026-00011", "status": "ready", "totalAmount": 470000,
        "student": { "studentCode": "SV2024032", "fullName": "Phạm Quốc Dũng" }, "roomNumber": "A108",
        "items": [ { "name": "Đệm mút 90x190cm", "quantity": 1, "amount": 350000 },
                   { "name": "Vỏ đệm 90x190cm", "quantity": 1, "amount": 120000 } ],
        "createdAt": "2026-09-12T09:30:00Z" }
    ],
    "total": 4, "page": 1, "limit": 20,
    "summary": { "pendingPayment": 6, "ready": 4, "deliveredToday": 9 }
  } }
```
> `summary` sits next to the pagination fields. The frontend `useApi` hook passes any extra field through on `meta`, so the screen reads it as `meta.summary`.

```json
{ "code": "INVALID_ORDER_STATUS", "message": "Chỉ giao được đơn đang chờ nhận hàng", "data": null } // 422
```

---

## 12. Dashboard — `modules/dashboard`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/dashboard/occupancy` | admin, staff, viewer | Total/occupied/available beds, per building |
| GET | `/api/dashboard/summary` | admin, staff, viewer | Occupancy + total debt + overdue count + expiring contracts + pending requests + pending applications + supply orders waiting for pickup |

**GET `/api/dashboard/occupancy`**
```json
{ "code": "OK", "message": "Success",
  "data": { "overall": { "total": 200, "occupied": 178, "available": 20, "maintenance": 2 },
            "byBuilding": [ { "buildingName": "Building B", "total": 50, "occupied": 45, "rate": 0.9 } ] } }
```
> ⚠️ Bed counts must always satisfy `total = occupied + available + maintenance`.
> ⚠️ `rate = occupied / (total − maintenance)` — maintenance beds are not rentable (`03` BR-05, FR-70). Rooms of each building may also carry `buildingId`, `buildingCode`, `available`, `maintenance`.

**GET `/api/dashboard/summary`** *(shape the frontend consumes — v1.2.5)*
```json
{ "code": "OK", "message": "Success",
  "data": {
    "occupancy": { "total": 98, "occupied": 72, "available": 24, "maintenance": 2, "rate": 0.75 },
    "residents": {
      "activeStudents": 72, "activeContracts": 72, "expiringIn30Days": 11,
      "contractsByStatus": { "active": 72, "expired": 2, "terminated": 1 }
    },
    "finance": { "totalDebt": 33682500, "overdueInvoiceCount": 18, "overdueAmount": 14519000 },
    "pendingRequests": { "renewal": 2, "checkout": 3 },
    "pendingApplications": 6,
    "supplyOrdersReady": 2
  } }
```
> `expiringIn30Days` uses BR-29 (`0 ≤ endDate − today ≤ 30`). `totalDebt` = sum of `totalAmount − paidAmount` over `unpaid`/`partial`/`overdue` invoices.
>
> **Backend status (15/09/2026, `BE_QLKTX` first-commit):** the endpoint exists but returns a different shape — `occupancy.{totalBeds, occupiedBeds, availableBeds, maintenanceBeds, occupancyRate}`, `finance.{totalRevenue, totalOutstandingDebt, overdueInvoiceCount}`, `queue.{pendingRequests (number), expiringContracts}`. Missing: `residents.activeStudents`, `contractsByStatus`, `overdueAmount`, `pendingRequests` split by type, `pendingApplications`, `supplyOrdersReady`. Its `occupancyRate` divides by `total` (includes maintenance). The frontend adapter `normalizeSummary` (`features/dashboard/api/dashboard.api.js`) accepts both shapes, recomputes the rate and shows "—" for missing fields — please align the backend with the shape above.

---

## 13. Error Codes Reference

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |
| `TOKEN_EXPIRED` | 401 | JWT expired — log in again |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password at login |
| `ACCOUNT_LOCKED` | 403 | Login with a deactivated account (`isActive: false`) |
| `INVALID_CURRENT_PASSWORD` | 400 | Change password with a wrong current password |
| `FORBIDDEN` | 403 | Valid user, insufficient role, or accessing another student's data |
| `NOT_FOUND` | 404 | Resource does not exist |
| `ROOM_FULL` | 409 | No available bed left in the room *(v1.2 — replaces `BED_NOT_AVAILABLE`)* |
| `DUPLICATE_ENTRY` | 409 | Unique index violation (e.g., `studentCode`, `email`) |
| `DUPLICATE_PENDING_REQUEST` | 409 | Student already has an open request of that type |
| `DUPLICATE_PENDING_APPLICATION` | 409 | Student already has a pending application *(v1.2)* |
| `GENDER_MISMATCH` | 422 | Student gender does not match room gender *(A1)* |
| `STUDENT_HAS_ACTIVE_CONTRACT` | 422 | Student already has an `active` contract |
| `STUDENT_HAS_DEBT` | 422 | Student still owes money |
| `CONTRACT_NOT_ACTIVE` | 422 | Operation requires an `active` contract |
| `APPLICATION_NOT_PENDING` | 422 | Application was already approved, rejected or cancelled *(v1.2)* |
| `REQUEST_NOT_PENDING` | 422 | Renewal/checkout request was already processed or cancelled |
| `CANNOT_MODIFY_SELF` | 422 | Admin tried to lock, demote or reset their own account |
| `LAST_ACTIVE_ADMIN` | 422 | Would leave the system without an active admin (BR-83) |
| `BUILDING_HAS_OCCUPANTS` | 422 | Cannot deactivate a building that still has occupied beds (FR-25) |
| `ROOM_TYPE_MISMATCH` | 422 | Staff tried to switch an application to a room of another type *(v1.2)* |
| `ROOM_TYPE_IN_USE` | 422 | Cannot change tier/capacity of a room type that rooms already use *(v1.2)* |
| `ROOM_HAS_OCCUPANTS` | 422 | Cannot change room type or gender of an occupied room *(v1.2)* |
| `BED_OCCUPIED` | 422 | Cannot set an occupied bed to maintenance |
| `INVOICE_ALREADY_PAID` | 422 | Invoice already fully paid |
| `INVOICE_HAS_PAYMENT` | 422 | Cannot cancel an invoice that has payments |
| `PAYMENT_EXCEEDS_REMAINING` | 422 | Payment larger than the outstanding balance |
| `INVALID_METER_READING` | 422 | End reading below start reading *(A2)* |
| `READING_ALREADY_INVOICED` | 422 | Meter reading locked after invoicing *(A2)* |
| `SUPPLY_ITEM_INACTIVE` | 422 | Ordered item is no longer sold *(v1.2)* |
| `SUPPLY_ALREADY_INCLUDED` | 422 | Ordered item is already issued with the student's room type *(v1.2)* |
| `ORDER_NOT_CANCELLABLE` | 422 | Order is no longer `pending_payment` or its invoice has a payment *(v1.2)* |
| `INVALID_ORDER_STATUS` | 422 | Order is not in the status the action requires *(v1.2)* |
| `GATEWAY_SIGNATURE_INVALID` | 400 | VNPay/ZaloPay webhook signature check failed |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

> **Removed in v1.2:** `BED_NOT_AVAILABLE` (now `ROOM_FULL`) and `ROOM_CAPACITY_EXCEEDED` (beds can no longer be added by hand).

---

## 14. Notes for AI Coding Assistants

- When implementing an endpoint above, only the corresponding `modules/<feature>/` folder + `core/` + `shared/` should be needed as context (`ARCHITECTURE.md` §7).
- Controllers translate HTTP ↔ service calls only; put the business rules referenced here (gender check, bed assignment, status cascades, webhook idempotency, utility split, supply order totals) in `*.service.js`, not in the controller or route file.
- Cross-feature effects (application approval → bed claim → Residency → Contract → invoices; payment → supply order `ready`; checkout → cancel supply orders → Residency close → Bed release → deposit settlement) must go through the target feature's service function, never its model directly (`ARCHITECTURE.md` §3.4).
- Bed assignment takes the lowest free bed of the room with an atomic conditional update, **not** read-then-write (`ARCHITECTURE.md` §3.5). No endpoint accepts a bed id.
- Never trust a price from the client — supply order totals and contract prices are always read from the database.

---

## 15. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 12/09/2026 | Initial API reference |
| 1.2.8 | 15/09/2026 | Portal (SCR-61): documented the `GET /portal/my-residence` response (`hasResidence`, `contract`, `roomType`, `includedInRoom`, `roommates`, `debtSummary`). Backend gap analysis for FE integration in `docs/16-YEU-CAU-API-BACKEND.md`. |
| 1.2.7 | 15/09/2026 | Buildings (SCR-21): `includeInactive` list flag, `stats` shape with `maintenanceBeds`, create/update bodies, `BUILDING_HAS_OCCUPANTS`; recorded backend differences. |
| 1.2.6 | 15/09/2026 | Accounts (SCR-81): new §2.1 `GET/POST /users`, `PUT /users/:id`, `PATCH /users/:id/status` with list `summary`; create returns a one-time temporary password; errors `CANNOT_MODIFY_SELF`, `LAST_ACTIVE_ADMIN`; student list `hasAccount`. Backend currently only has `POST /users/:id/reset-password` (T3.16 pending). |
| 1.2.5 | 15/09/2026 | Dashboard (SCR-10): documented the `GET /dashboard/summary` response shape and the occupancy rate rule; recorded current backend differences. |
| 1.2.4 | 15/09/2026 | Portal requests (SCR-66): list shape/sort, create validation rules (BR-72, checkout date range, required checkout reason), cancel returns `REQUEST_NOT_PENDING`. |
| 1.2.3 | 15/09/2026 | Requests (SCR-41, additive): list `summary`/`byType`, search and sort rules, `requestCode`; detail adds `student`, `contract`, `unpaidInvoices`, `settlementPreview` (with BR-31 prorated rent), `checklist`, `renewalPreview`; checkout approve accepts `refundMethod`, settlement returns `proratedRent`/`refundMethod`; new error `REQUEST_NOT_PENDING`. Approving a checkout also cancels the contract's other pending requests. |
| 1.2.2 | 15/09/2026 | Contracts (SCR-32, additive): list `summary` counts, sort/search rules and extra row fields; detail adds `student`, `depositStatus`, `invoices`, `pendingRequests`, `unpaidSupplyOrders`, `history`; terminate body `{ reason, terminationDate }` and `settlement` response. |
| 1.2.1 | 15/09/2026 | FE integration notes (additive, no breaking change): `GET /rooms/:id` example, bed status body `{ status, note? }`; `GET /applications` `summary` counts + sort/search rules; application detail adds `requestedRoom.buildingCode/floor`, `roomType.tier/capacity`, `reviewedAt`, `reviewNote`, `assigned`, `contractCode`; `GET /rooms/available` accepts `gender` for staff. |
| **1.2** | **13/09/2026** | **Register by room, not bed.** Added room types (§4), applications with automatic bed assignment (§5.1), the supplies module (§11) and the matching portal endpoints (§10). Removed manual bed endpoints, `GET /beds/available`, `POST /residencies`, `POST /contracts` and contract activation. `BED_NOT_AVAILABLE` → `ROOM_FULL`; 10 new error codes (29 total). Dashboard and later sections renumbered §12–§15. |
| 1.1 | 12/09/2026 | Added utility-reading endpoints and `GENDER_MISMATCH` (A1, A2); checkout approval now returns a `settlement` block (A3). Added password reset, invoice cancel, payment reconcile, and the full `/api/portal/*` group. Documented field-level validation error shape, the two-invoice contract activation, webhook behaviour table, and 11 new error codes. |
