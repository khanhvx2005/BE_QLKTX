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
| POST | `/api/auth/register` | public | Student self-registration — **links to an existing `Student` record**, never creates one (FR-80, FR-81); `role` forced to `student` server-side |
| POST | `/api/auth/login` | public | Returns JWT + user profile |
| POST | `/api/auth/logout` | authenticated | Client clears the token |
| GET | `/api/auth/me` | authenticated | Current user profile |
| PATCH | `/api/auth/change-password` | authenticated | Change own password |
| POST | `/api/users/:id/reset-password` | admin, staff | Issue a one-time temporary password (`FR-09`). Staff may not reset an `admin` account |
| GET | `/api/users` | admin | Account list — `?search=&role=&isActive=true\|false&page=&limit=` *(v1.2.6)* |
| POST | `/api/users` | admin | Create an account — `{ email, fullName, role, studentId? }`; returns a one-time temporary password *(v1.2.6)* |
| PUT | `/api/users/:id` | admin | Update `{ email, fullName, role }` *(v1.2.6)* |
| PATCH | `/api/users/:id/status` | admin | Lock / unlock — `{ isActive }` *(v1.2.6)* |

**POST `/api/auth/register`** *(v1.2.18 — SCR-02)*
```json
// request
{ "studentCode": "SV2026080", "fullName": "Bùi Ngọc Ánh", "email": "ngocanh@sv.edu.vn",
  "phone": "0912345678", "gender": "female", "password": "••••••••" }
// response 201 — same shape as login, so the student lands straight in the portal
{ "code": "OK", "message": "Đăng ký tài khoản thành công",
  "data": { "token": "eyJhbGciOi…", "expiresIn": 604800,
            "user": { "id": "665e9a…", "email": "ngocanh@sv.edu.vn", "fullName": "Bùi Ngọc Ánh",
                      "role": "student", "studentId": "665e3a…", "mustChangePassword": false } } }
```
> The account is **attached to the `Student` record the staff already manage** (FR-80). The server must not create a new student profile — a self-registered profile would have no room, no contract and no way to be matched later.
>
> Checks, in this order:
> - `studentCode` not in `Student` → `422 STUDENT_NOT_FOUND`, message telling the student to contact the dormitory office (FR-81).
> - `fullName` does not match that record (compare ignoring accents, case and extra spaces) → `422 STUDENT_INFO_MISMATCH`.
> - That student already has a `User` → `409 STUDENT_ALREADY_HAS_ACCOUNT`.
> - `email` already used → `409 DUPLICATE_ENTRY` with a field error on `email`.
> - Password: at least 8 characters with letters and digits (BR-81) → `400 VALIDATION_ERROR` on `password`.
>
> The screen shows the first three as errors under the **Mã số sinh viên** field, so the student sees which value to fix.
>
> **Backend status (16/09/2026):** `register` **creates a new `User` + `Student`** from the form instead of linking to the existing record, so any code can register and the account is never tied to the managed profile. Password rule is min 6 with no character check.

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
| GET | `/api/fee-types` | admin, staff, viewer | List fee types — active only by default; `?includeInactive=true` adds inactive ones (SCR-82) |
| POST | `/api/fee-types` | admin | Create fee type — `{ code, name, unit, defaultAmount, isRecurring }` |
| PUT | `/api/fee-types/:id` | admin | Update `{ name, unit, defaultAmount, isRecurring, isActive }` — `code` cannot change; no delete endpoint |
| GET | `/api/utility-readings` | admin, staff, viewer | List — `?billingPeriod=2026-10&buildingId=&roomId=` |
| POST | `/api/utility-readings` | admin, staff | Enter meter readings for one room/period |
| PUT | `/api/utility-readings/:id` | admin, staff | Edit the four readings — keeps the frozen unit prices; rejected once `isInvoiced: true` |
| GET | `/api/invoices/generation-preview` | admin, staff | Preview a bulk generation — `?billingPeriod=&buildingIds=id1,id2`; **never writes** *(v1.2.11)* |
| POST | `/api/invoices/generate` | admin, staff | Bulk-generate invoices for a billing period |
| GET | `/api/invoices` | admin, staff, viewer | List — `?search=&studentId=&status=&billingPeriod=&buildingId=&type=deposit\|monthly\|settlement\|supplies\|other`, with `summary` |
| GET | `/api/invoices/:id` | admin, staff, viewer, student (own) | Get one, with line items and payments |
| POST | `/api/invoices` | admin, staff | Create a one-off invoice manually |
| PATCH | `/api/invoices/:id/cancel` | admin, staff | Cancel — only if no successful payment exists; not for `supplies`/`settlement` |
| GET | `/api/invoices/overdue` | admin, staff, viewer | Overdue invoices (dashboard list) |

**GET `/api/fee-types?includeInactive=true`** *(v1.2.9)*
```json
{ "code": "OK", "message": "Success",
  "data": [
    { "id": "665e2a...", "code": "electricity", "name": "Tiền điện", "unit": "kWh", "defaultAmount": 2500,
      "isRecurring": true, "isActive": true, "isSystem": true, "updatedAt": "2026-08-01T08:00:00+07:00" },
    { "id": "665e2f...", "code": "lost_key", "name": "Làm mất chìa khóa", "unit": "chiếc", "defaultAmount": 50000,
      "isRecurring": false, "isActive": true, "isSystem": false, "updatedAt": "2026-08-20T09:30:00+07:00" }
  ] }
```
> Plain array. `isSystem` is `true` for the six codes the billing flow depends on (`rent`, `electricity`, `water`, `deposit`, `supplies`, `other`).
> - Create: `code` lowercase `^[a-z][a-z0-9_]{1,29}$`, unique → `409 DUPLICATE_ENTRY` with a field error on `code`. `defaultAmount` is a non-negative integer; for `electricity`/`water` it must be `> 0`.
> - Update: a system fee type cannot be deactivated → `422 FEE_TYPE_REQUIRED`, and its `isRecurring` is fixed. Changing the electricity/water price only affects readings entered afterwards (BR-52).
> - For a non-system fee type `defaultAmount` is only the suggested unit price when staff add a manual invoice line; `0` means "type the amount each time".
>
> **Backend status (15/09/2026):** returns the v1.1 shape — codes `ROOM_FEE`, `ELECTRICITY`, `WATER`, `DEPOSIT`, fields `unitPrice`/`isMetered`, no `isRecurring`/`isSystem`, active only (ignores `includeInactive`), duplicate code returns `FEE_TYPE_CODE_ALREADY_EXISTS`. The frontend normalises the list (lowercase codes, `ROOM_FEE` → `rent`, `unitPrice` → `defaultAmount`) so the screen reads correctly; writes are not verified against the backend.

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

**GET `/api/utility-readings?billingPeriod=2026-10&buildingId=665f0a...`** *(v1.2.10 — SCR-51)*
```json
{ "code": "OK", "message": "Success",
  "data": { "items": [
    { "id": "665f8a...", "roomId": "665f2a...", "roomNumber": "203", "buildingId": "665f0a...", "buildingName": "Tòa B",
      "billingPeriod": "2026-10",
      "electricityStart": 1250, "electricityEnd": 1340, "waterStart": 85, "waterEnd": 97,
      "electricityUnitPrice": 3500, "waterUnitPrice": 15000,
      "electricityConsumption": 90, "electricityAmount": 315000, "waterConsumption": 12, "waterAmount": 180000,
      "isInvoiced": false, "recordedByName": "Lê Thị Nhân Viên", "recordedAt": "2026-10-27T16:30:00+07:00" }
  ], "total": 17, "page": 1, "limit": 100 } }
```
> - `roomId` is a plain id (not populated). One item per room that already has a reading for the period — rooms without a reading are simply absent.
> - The entry screen loads three lists for one building: `GET /rooms?buildingId=` (occupancy), this period's readings and the **previous** period's readings. A room's start readings default to the previous period's end readings (BR-51); the user may change them and only gets a warning.
> - Readings are non-negative integers. `billingPeriod` after the current month → `400 VALIDATION_ERROR` on `billingPeriod`. A second `POST` for the same room + period → `409 DUPLICATE_ENTRY` (use `PUT`).
> - The per-person amount on screen is an estimate: `floor(roomTotal / occupants)` with the remainder added to the smallest student code, using the room's **current** occupants. The real split happens at invoice generation with the students residing during the period.
>
> **Backend status (15/09/2026):** list returns a plain array with `roomId` populated as a room object, no pagination; `PUT` has no Joi validation; duplicate returns `READING_ALREADY_EXISTS`. The frontend accepts both list shapes and a populated `roomId`.

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

**GET `/api/invoices/generation-preview?billingPeriod=2026-10&buildingIds=665f0a...`** *(v1.2.11 — SCR-53)*
```json
{ "code": "OK", "message": "Success",
  "data": {
    "created": 52, "updated": 3, "totalAmount": 29307000,
    "eligibleStudents": 55, "readyRooms": 14,
    "skipped": [
      { "roomId": "665f2b...", "roomNumber": "206", "buildingCode": "B", "code": "NO_READING", "reason": "Chưa nhập chỉ số điện nước" },
      { "roomId": "665f2c...", "roomNumber": "101", "buildingCode": "A", "code": "ALREADY_INVOICED", "reason": "Kỳ này đã lập hóa đơn" },
      { "roomId": "665f2d...", "roomNumber": "310", "buildingCode": "B", "code": "NO_RESIDENT", "reason": "Không có sinh viên đang ở" }
    ]
  } }
```
> - Runs exactly the same calculation as `POST /invoices/generate` but writes nothing. The generate response has the same shape.
> - It is a **separate GET on purpose**: a `dryRun` flag on the POST would silently create real invoices on a backend that ignores the flag.
> - `buildingIds` omitted = all active buildings. `billingPeriod` after the current month → `400 VALIDATION_ERROR`.
> - `skipped[].code`: `NO_READING` · `ALREADY_INVOICED` (the room's reading is already `isInvoiced`) · `NO_RESIDENT`. The modal lists `NO_READING` rooms with a link to the reading screen.
> - Generated line items: rent `Tiền phòng tháng 10/2026`, then `Tiền điện tháng 10/2026 (90 kWh, chia đều 4 người)` and the water equivalent, each with `quantity: 1` and `unitPrice = amount = share`. Generating marks each processed room's reading `isInvoiced: true`.

**GET `/api/invoices`** *(v1.2.11 — SCR-52)*
```json
{ "code": "OK", "message": "Success",
  "data": {
    "items": [
      { "id": "665f5c...", "invoiceCode": "INV-202610-00042", "type": "monthly", "billingPeriod": "2026-10",
        "studentId": "665e3a...", "studentName": "Trần Thị Bích", "studentCode": "SV2024001",
        "contractId": "6660c1...", "bedCode": "B203-02", "roomNumber": "203", "buildingId": "665f0a...", "buildingCode": "B", "buildingName": "Tòa B",
        "lineItems": [ { "feeTypeId": "665e2a...", "description": "Tiền phòng tháng 10/2026", "quantity": 1, "unitPrice": 320000, "amount": 320000 } ],
        "totalAmount": 443750, "paidAmount": 200000, "remainingAmount": 243750,
        "issueDate": "2026-11-01", "dueDate": "2026-11-10", "status": "partial" }
    ],
    "total": 128, "page": 1, "limit": 10,
    "summary": { "totalAmount": 48620000, "paidAmount": 36150000, "remainingAmount": 12470000, "overdueCount": 7, "overdueAmount": 3120000 }
  } }
```
> - Flat student/room fields, no populated objects. `search` matches invoice code, student code, student name and bed code.
> - Sort: newest `issueDate` first.
> - `summary` covers the whole filtered set (not just the page) and **excludes cancelled invoices**.

**POST `/api/invoices`** *(v1.2.11 — one-off invoice, FR-46)*
```json
{ "contractId": "6660c1...", "studentId": "665e3a...", "dueDate": "2026-09-22", "note": "Biên bản ngày 12/09",
  "lineItems": [ { "feeTypeId": "665e2f...", "description": "Làm mất chìa khóa", "quantity": 1, "unitPrice": 50000 } ] }
```
> - `type` is always `other` and `billingPeriod` is `null`, so two one-off invoices in the same month never hit the anti-duplicate index.
> - The contract must be `active` → otherwise `422 CONTRACT_NOT_ACTIVE`.
> - Fee types `rent`, `deposit`, `supplies` are rejected: their amounts come from the contract or an order.
> - `amount` and `totalAmount` are computed by the server (BR-41, BR-42). Field errors use paths such as `lineItems.0.unitPrice`.

**PATCH `/api/invoices/:id/cancel`** *(v1.2.11)*
> - `422 INVOICE_HAS_PAYMENT` when `paidAmount > 0` (BR-46).
> - `422 INVOICE_NOT_CANCELLABLE` for an already-cancelled invoice, a `supplies` invoice (cancel the order instead) or a `settlement` invoice.
> - Cancelling a `monthly` invoice: once no non-cancelled monthly invoice with utility lines remains for that room and period, the room's reading goes back to `isInvoiced: false`, so it can be corrected and invoiced again.
>
> **Backend status (15/09/2026):**
> - No `generation-preview`: `GET /invoices/generation-preview` is caught by `/invoices/:id` and returns `400`, so the modal shows an error and blocks generating. Nothing is written.
> - The list returns `studentId` populated, `items[{ name }]` instead of `lineItems`, no `remainingAmount`/`summary`/room fields, and no `search`/`buildingId` filters. The frontend normalises student, line items and remaining amount.

---

## 8. Payments — `modules/payments`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/payments` | admin, staff, viewer | List — `?search=&invoiceId=&studentId=&type=payment\|refund&method=&status=&from=&to=`, with `summary` |
| POST | `/api/payments/offline` | admin, staff | Record manual cash/bank-transfer payment — `{ invoiceId, amount, method, paidAt, bankReference?, note? }` |
| POST | `/api/payments/online/checkout` | student | Start a VNPay/ZaloPay session — returns redirect URL / QR |
| POST | `/api/payments/webhook/vnpay` | public (gateway signed) | VNPay callback — verifies signature, updates `Payment` + `Invoice` |
| POST | `/api/payments/webhook/zalopay` | public (gateway signed) | ZaloPay callback — same as above |
| POST | `/api/payments/:id/reconcile` | admin, staff | Re-query the gateway for a stuck `pending` online transaction (FR-56, BR-64) |

**GET `/api/payments`** *(v1.2.13 — SCR-56)*
```json
{ "code": "OK", "message": "Success",
  "data": {
    "items": [
      { "id": "6662c1...", "transactionRef": "PAY20260913ABC123",
        "studentId": "665e3a...", "studentName": "Trần Thị Bích", "studentCode": "SV2024001",
        "invoiceId": "665f5c...", "invoiceCode": "INV-202610-00042", "invoiceType": "monthly",
        "amount": 243750, "type": "payment", "method": "bank_transfer", "status": "success",
        "bankReference": "FT26256891042", "gatewayTransactionId": null,
        "createdAt": "2026-09-13T14:29:00+07:00", "paidAt": "2026-09-13T14:30:00+07:00",
        "recordedByName": "Lê Thị Nhân Viên", "note": "Nộp đợt 2" }
    ],
    "total": 128, "page": 1, "limit": 20,
    "summary": { "collectedAmount": 66763500, "refundedAmount": 1250000, "successCount": 115, "pendingCount": 2, "failedCount": 1 }
  } }
```
> - Flat student/invoice fields, not populated objects. `search` matches transaction reference, invoice code, student name/code, bank reference and gateway id.
> - Sort: newest first by `paidAt`, falling back to `createdAt` for transactions that never succeeded.
> - `from`/`to` are dates (`YYYY-MM-DD`) on that same timestamp.
> - `summary` covers the whole filtered set: `collectedAmount` counts successful `payment` rows, `refundedAmount` successful `refund` rows, `failedCount` = `failed` + `expired`.

**POST `/api/payments/:id/reconcile`** *(v1.2.13 — SCR-56)*
```json
// response — gateway says the transaction went through
{ "code": "OK", "message": "Cổng thanh toán báo giao dịch PAY20260913ABC123 đã thành công — đã cập nhật hóa đơn",
  "data": { "payment": { "id": "6662c1...", "status": "success", "paidAt": "2026-09-16T11:20:00+07:00", "gatewayTransactionId": "VNP090116" },
            "invoice": { "id": "665f5c...", "paidAmount": 443750, "remainingAmount": 0, "status": "paid" } } }
```
> - Only for `pending` transactions paid through a gateway. `cash`/`bank_transfer` → `422 PAYMENT_NOT_ONLINE`; any other status → `422 PAYMENT_NOT_PENDING`.
> - Success recomputes the invoice from successful payments (BR-43) and moves a paid `supplies` invoice's order to `ready` (BR-95). No answer from the gateway past 15 minutes → `expired` (BR-64).
> - The message is shown to the user, so it states the outcome.

**POST `/api/payments/offline`** *(v1.2.12 — SCR-55)*
```json
// request — bankReference required when method = bank_transfer
{ "invoiceId": "665f5c...", "amount": 243750, "method": "bank_transfer", "paidAt": "2026-09-13",
  "bankReference": "FT26256891042", "note": "Nộp đợt 2" }
// response 201
{ "code": "OK", "message": "Đã thu 243.750 đ — hóa đơn đã thanh toán đủ",
  "data": {
    "payment": { "id": "6662c1...", "transactionRef": "PAY20260913ABC123", "invoiceId": "665f5c...", "amount": 243750, "type": "payment",
                 "method": "bank_transfer", "bankReference": "FT26256891042", "status": "success",
                 "paidAt": "2026-09-13T14:30:00+07:00", "recordedByName": "Lê Thị Nhân Viên", "note": "Nộp đợt 2" },
    "invoice": { "id": "665f5c...", "totalAmount": 443750, "paidAmount": 443750, "remainingAmount": 0, "status": "paid" },
    "supplyOrder": null
  } }
```
> - Offline payments are recorded as `success` immediately. `paidAmount` is then **recomputed** from successful payments (BR-43).
> - `paidAt` is a date not after today; the server adds the current time.
> - `bankReference` is uppercased; the same reference on another successful payment → `409 DUPLICATE_ENTRY` with a field error on `bankReference`, so one bank transfer is never recorded twice.
> - A `supplies` invoice that becomes `paid` moves its order to `ready` (BR-95); the order is returned in `supplyOrder` so the screen can say so.
>
> Errors:
> - `400 VALIDATION_ERROR`: `amount` ≤ 0, missing `method`/`paidAt`, `bankReference` missing for bank transfer.
> - `422 PAYMENT_EXCEEDS_REMAINING` (BR-44).
> - `422 INVOICE_ALREADY_PAID` (BR-45).
> - `422 INVOICE_CANCELLED`.

**GET `/api/invoices/:id`** *(v1.2.12 — SCR-54)*
> Same fields as a list item (§7 v1.2.11), plus:
> - `contractCode`, `note`.
> - `payments[]`, oldest first: `transactionRef`, `amount`, `type`, `method`, `status`, `paidAt`, `recordedByName`, `bankReference`, `gatewayTransactionId`, `note`.
> - `supplyOrder: { id, orderCode, status } | null` for `supplies` invoices.
>
> Utility line descriptions keep the `(… kWh, chia đều N người)` suffix; the screen shows it as a second line.
>
> **Backend status (15/09/2026):**
> - Detail has no `payments`, contract code or room fields, and still uses `items[{ name }]`.
> - The frontend falls back to `GET /payments?invoiceId=`, mapping `paymentMethod`, `transactionId` and `recordedBy.fullName`.
> - The offline body uses `paymentMethod`, has no `bankReference`/`paidAt` and allows `bank_transfer` without a reference. Recording from the screen is not verified against the backend.

**GET `/api/portal/my-payments?transactionRef=PAY20260916ABC`** *(v1.2.16 — SCR-65)*
```json
{ "code": "OK", "message": "Success",
  "data": [
    { "id": "6662d1...", "transactionRef": "PAY20260916ABC", "invoiceId": "665f5c...", "invoiceCode": "INV-202611-00150",
      "invoiceType": "supplies", "amount": 160000, "type": "payment", "method": "vnpay", "status": "pending",
      "gatewayTransactionId": null, "createdAt": "2026-09-16T13:42:00+07:00", "paidAt": null }
  ] }
```
> - The result screen calls this **up to 5 times, 2 seconds apart**, because the gateway webhook can arrive after the student is redirected back.
> - Still `pending` after the last try → the screen says "đang được xử lý" with a retry button. It must **never** claim failure while the outcome is unknown.
> - `status: 'success'` on a `supplies` invoice → the screen also tells the student the order is ready to collect (BR-95).

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
| GET | `/api/portal/profile` | student | Own profile (read-only) — full `Student` record incl. `dob`, `faculty`, `className`, `phone`, `email`, `emergencyContact` |
| GET | `/api/portal/my-residence` | student | Current building/room/bed, room type with everything issued, contract + debt summary |
| GET | `/api/portal/my-contracts` | student | Current + historical contracts — plain array, newest first; history rows need `contractCode`, `bedCode`, `buildingName`, dates, `status`, `terminationReason` (FR-39) |
| GET | `/api/portal/my-invoices` | student | Own invoices — `?status=&type=` |
| GET | `/api/portal/my-invoices/:id` | student | Own invoice detail with line items |
| GET | `/api/portal/my-payments` | student | Own payment history — `?transactionRef=` to poll one transaction (SCR-65) |
| GET | `/api/portal/my-requests` | student | Own renewal/checkout requests — plain array, newest first, same fields as the staff list item (`requestCode`, `renewal`, `settlement`, `reviewNote`, `reviewedAt`) |
| POST | `/api/portal/my-requests` | student | Submit a renewal or checkout request |
| DELETE | `/api/portal/my-requests/:id` | student | Cancel own request while still `pending` — otherwise `422 REQUEST_NOT_PENDING` (BR-79) |
| GET | `/api/portal/my-applications` | student | Own applications *(v1.2)* |
| POST | `/api/portal/my-applications` | student | Submit an application — `{ roomId, startDate, endDate, note }` *(v1.2)* |
| DELETE | `/api/portal/my-applications/:id` | student | Cancel own application while `pending` *(v1.2)* |
| GET | `/api/portal/supply-items` | student | Shop: active items **not** issued with the student's room type, plus what is issued *(v1.2)* |
| GET | `/api/portal/my-supply-orders` | student | Own orders — `?status=` *(v1.2)* — newest first, each with `items`, `totalAmount`, `invoiceId`, `status`, `createdAt`, `cancelReason` |
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

**Shop and orders for the student screens (SCR-67/68)** *(v1.2.17)*
> - `GET /portal/supply-items` drives the shop: `items` already excludes what the room type provides (FR-101) and what is no longer sold, so the screen never has to filter. `roomNumber` + `roomType.name` + `includedInRoom` fill the banner. No active contract → `422 CONTRACT_NOT_ACTIVE`, and the screen shows a link to apply for a room.
> - `POST /portal/my-supply-orders` takes **only** `{ supplyItemId, quantity }` per line (1–5, BR-91); the screen shows a cart total but the amount that counts comes back in the response (BR-92).
> - The response `{ orderCode, totalAmount, invoice: { id, invoiceCode, totalAmount, dueDate } }` is what the success notice needs — order code, amount, due date and a link straight to the invoice.
> - `PATCH /portal/my-supply-orders/:id/cancel` needs no body from the student (the reason is recorded as a self-cancel); it must cancel the linked invoice too (FR-105).
>
> **Backend status (16/09/2026):** the portal supplies endpoints do not exist yet (`404`), like the rest of `/api/portal/*`.

---

## 11. Supplies — `modules/supplies` *(v1.2)*

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/supply-items` | admin, staff, viewer | Catalog — `?search=&category=&isActive=`, paginated |
| POST | `/api/supply-items` | admin, staff | Create item |
| PUT | `/api/supply-items/:id` | admin, staff | Update price, image URL, included room types, `isActive` |
| GET | `/api/supply-orders` | admin, staff, viewer | List — `?status=&search=&from=&to=`; response adds a `summary` block |
| GET | `/api/supply-orders/:id` | admin, staff, viewer | Detail |
| PATCH | `/api/supply-orders/:id/deliver` | admin, staff | `ready → delivered` |
| PATCH | `/api/supply-orders/:id/cancel` | admin, staff | `pending_payment → cancelled` — `{ cancelReason }` (≥ 5 ký tự); cancels the linked invoice too |

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

**Supplies for the staff screen (SCR-71)** *(v1.2.14)*
> - `GET /supply-orders` also accepts `from`/`to` (order date, `YYYY-MM-DD`); `search` matches order code, student code/name and room number. Newest first.
> - `summary` carries every status count the screen shows: `{ all, pendingPayment, ready, delivered, cancelled, deliveredToday }`.
> - Order items are flat: `studentName`, `studentCode`, `roomCode` (e.g. `B203`), `buildingName`, `items[{ supplyItemId, name, unitPrice, quantity, amount }]`, `totalAmount`, `invoiceId`, `status`, `createdAt`, `deliveredAt`, `deliveredByName`, `cancelledAt`, `cancelReason`.
> - `GET /supply-orders/:id` adds `invoice` (with `invoiceCode`, `remainingAmount`, `dueDate`) so the screen can link to the invoice and collect payment at the counter.
> - `PATCH /supply-orders/:id/deliver` records who delivered it (`deliveredByName` in the response, FR-104).
> - `GET /supply-items` is paginated and each item carries `includedRoomTypeNames` next to `includedInRoomTypes`, so the catalog can show room-type tags without a second call.
> - `POST`/`PUT /supply-items` body: `{ name, category, unit, price, description, imageUrl, includedInRoomTypes, isActive }`.
>
> **Backend status (16/09/2026):** the whole supplies module is missing — `/api/supply-items` and `/api/supply-orders` return `404`. The screen shows the missing-endpoint message on both tabs and stays read-only until the backend adds it.

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
| `STUDENT_NOT_FOUND` | 422 | Self-registration: no student record with that code *(v1.2.18)* |
| `STUDENT_INFO_MISMATCH` | 422 | Self-registration: name does not match the student record *(v1.2.18)* |
| `STUDENT_ALREADY_HAS_ACCOUNT` | 409 | Self-registration: that student already has an account *(v1.2.18)* |
| `STUDENT_HAS_ACTIVE_CONTRACT` | 422 | Student already has an `active` contract |
| `STUDENT_HAS_DEBT` | 422 | Student still owes money |
| `CONTRACT_NOT_ACTIVE` | 422 | Operation requires an `active` contract |
| `APPLICATION_NOT_PENDING` | 422 | Application was already approved, rejected or cancelled *(v1.2)* |
| `REQUEST_NOT_PENDING` | 422 | Renewal/checkout request was already processed or cancelled |
| `CANNOT_MODIFY_SELF` | 422 | Admin tried to lock, demote or reset their own account |
| `LAST_ACTIVE_ADMIN` | 422 | Would leave the system without an active admin (BR-83) |
| `BUILDING_HAS_OCCUPANTS` | 422 | Cannot deactivate a building that still has occupied beds (FR-25) |
| `FEE_TYPE_REQUIRED` | 422 | Cannot deactivate one of the six system fee types used by billing (FR-45) |
| `ROOM_TYPE_MISMATCH` | 422 | Staff tried to switch an application to a room of another type *(v1.2)* |
| `ROOM_TYPE_IN_USE` | 422 | Cannot change tier/capacity of a room type that rooms already use *(v1.2)* |
| `ROOM_HAS_OCCUPANTS` | 422 | Cannot change room type or gender of an occupied room *(v1.2)* |
| `BED_OCCUPIED` | 422 | Cannot set an occupied bed to maintenance |
| `INVOICE_ALREADY_PAID` | 422 | Invoice already fully paid |
| `INVOICE_CANCELLED` | 422 | Cannot record a payment on a cancelled invoice *(v1.2.12)* |
| `PAYMENT_NOT_PENDING` | 422 | Reconcile only applies to a `pending` transaction *(v1.2.13)* |
| `PAYMENT_NOT_ONLINE` | 422 | Reconcile only applies to gateway payments, not counter payments *(v1.2.13)* |
| `INVOICE_HAS_PAYMENT` | 422 | Cannot cancel an invoice that has payments |
| `INVOICE_NOT_CANCELLABLE` | 422 | Invoice already cancelled, or is a `supplies`/`settlement` invoice that is cancelled elsewhere *(v1.2.11)* |
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
| 1.2.18 | 16/09/2026 | Student self-registration (SCR-02): `POST /auth/register` body/response, the link-to-existing-student rule (FR-80/81) and its three new error codes; recorded that the backend currently creates a new student instead. |
| 1.2.17 | 16/09/2026 | Portal shop + orders (SCR-67/68): what the shop screen needs from `/portal/supply-items`, the order response fields the success notice uses, student cancel without a body. |
| 1.2.16 | 16/09/2026 | Portal invoices + payment result (SCR-64/65): `/portal/my-payments` `transactionRef` filter and the polling contract behind the result screen; `/portal/my-invoices/:id` is the invoice detail shape (§7 v1.2.12) restricted to the student's own invoice. |
| 1.2.15 | 16/09/2026 | Portal residence + profile (SCR-63/69): `/portal/profile` field list for the read-only profile screen, `/portal/my-contracts` fields used by the residence history table. |
| 1.2.14 | 16/09/2026 | Supplies staff screen (SCR-71): `supply-orders` `from`/`to` + search fields, full `summary` counts, flat order fields with `roomCode`/`deliveredByName`, detail `invoice`; `supply-items` pagination + `includedRoomTypeNames` and the create/update body; cancel reason minimum length. |
| 1.2.13 | 16/09/2026 | Payment history (SCR-56): `GET /payments` flat fields, `search`/`from`/`to` filters, `summary`, sort rule; `POST /payments/:id/reconcile` response and rules with `PAYMENT_NOT_PENDING`, `PAYMENT_NOT_ONLINE`. |
| 1.2.12 | 15/09/2026 | Invoice detail + offline payment (SCR-54/55): `GET /invoices/:id` adds `contractCode`, `note`, `payments[]` with `recordedByName`/`bankReference`, `supplyOrder`; `POST /payments/offline` body `{ invoiceId, amount, method, paidAt, bankReference?, note? }` and response `{ payment, invoice, supplyOrder }`; duplicate bank reference, `INVOICE_CANCELLED`; `GET /payments` `type` filter. |
| 1.2.11 | 15/09/2026 | Invoices (SCR-52/53): list filters `search`/`buildingId`, flat room/student fields and `summary`; new `GET /invoices/generation-preview` (same shape as generate, adds `eligibleStudents`, `readyRooms`, `skipped[].code`); one-off `POST /invoices` body and rules; cancel rules with new `INVOICE_NOT_CANCELLABLE` and reading unlock. |
| 1.2.10 | 15/09/2026 | Utility readings (SCR-51): list item shape with `roomId`, `roomNumber`, frozen prices, amounts, `recordedByName`/`recordedAt`; `roomId` filter; `PUT` keeps frozen prices; future period and duplicate rules; how the entry screen prefills start readings. |
| 1.2.9 | 15/09/2026 | Fee types (SCR-82): `includeInactive` list flag, `isSystem`, create/update bodies and validation, `FEE_TYPE_REQUIRED`; recorded backend differences. |
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
