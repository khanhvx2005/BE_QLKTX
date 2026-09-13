# API Reference

**Project:** Dormitory Management System
**Version:** 1.1
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

**POST `/api/users/:id/reset-password`**
```json
{ "code": "OK", "message": "Đã đặt lại mật khẩu",
  "data": { "temporaryPassword": "Ktx7Rm2qPz", "mustChangePassword": true } }
```
> `temporaryPassword` is returned **once** and must never be written to a log.

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

## 4. Rooms & Beds — `modules/rooms`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/buildings` | admin, staff, viewer, student | List buildings with occupancy stats |
| POST | `/api/buildings` | admin, staff | Create building |
| PUT | `/api/buildings/:id` | admin, staff | Update |
| GET | `/api/rooms` | admin, staff, viewer, student | List rooms — `?buildingId=&gender=&hasAvailableBed=true` |
| POST | `/api/rooms` | admin, staff | Create room (**`gender` required**) |
| PUT | `/api/rooms/:id` | admin, staff | Update room (price, status, capacity) |
| GET | `/api/rooms/:roomId/beds` | admin, staff, viewer, student | List beds in a room, with status and occupant |
| POST | `/api/rooms/:roomId/beds` | admin, staff | Add a bed to a room |
| POST | `/api/rooms/:roomId/beds/generate` | admin, staff | Auto-create beds up to `capacity` |
| PATCH | `/api/beds/:id/status` | admin, staff | Manually set `maintenance`/`available` |
| GET | `/api/beds/available` | admin, staff, viewer, student | Browse available beds — `?buildingId=&gender=&maxPrice=` |

**POST `/api/rooms`**
```json
{ "buildingId": "665f0a...", "roomNumber": "101", "gender": "female",
  "capacity": 4, "pricePerBed": 400000 }
```
> `gender` is required *(PRD §2.9 A1)*. `pricePerBed` is the monthly price **for one student**, not the whole room.

**Error cases**
```json
{ "code": "ROOM_CAPACITY_EXCEEDED", "message": "Phòng A-101 đã đủ số giường", "data": null }        // 409
{ "code": "BED_OCCUPIED", "message": "Giường đang có người ở, không thể chuyển bảo trì", "data": null } // 422
```

---

## 5. Residencies — `modules/residencies`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/residencies` | admin, staff, viewer | List — `?studentId=&bedId=&status=active` |
| GET | `/api/residencies/:id` | admin, staff, viewer, student (own) | Get one |
| POST | `/api/residencies` | admin, staff | Register student into a bed — atomically flips `Bed.status → occupied` |
| PATCH | `/api/residencies/:id/close` | admin, staff | Close residency — flips `Bed.status → available` |

**POST `/api/residencies`**
```json
// request
{ "studentId": "665f1a...", "bedId": "665f2b...", "startDate": "2026-09-01" }
// response 201
{ "code": "OK", "message": "Đăng ký lưu trú thành công", "data": { "id": "665f3c...", "status": "active" } }
```

**Error cases**
```json
{ "code": "BED_NOT_AVAILABLE", "message": "Giường A-101-02 đã có người ở", "data": null }                    // 409
{ "code": "GENDER_MISMATCH", "message": "Phòng này chỉ dành cho sinh viên nữ", "data": null }                // 422
{ "code": "STUDENT_HAS_ACTIVE_CONTRACT", "message": "Sinh viên đã có hợp đồng đang hiệu lực", "data": null } // 422
```
> `GENDER_MISMATCH` *(PRD §2.9 A1)* — compares `Student.gender` with `Room.gender`, **not** with the building.

---

## 6. Contracts — `modules/contracts`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/contracts` | admin, staff, viewer | List — `?status=&buildingId=&search=&expiringInDays=30` |
| GET | `/api/contracts/:id` | admin, staff, viewer, student (own) | Get one |
| POST | `/api/contracts` | admin, staff | Create (usually right after residency creation) |
| PUT | `/api/contracts/:id` | admin, staff | Update terms/dates |
| PATCH | `/api/contracts/:id/activate` | admin, staff | `pending → active`; **creates two invoices** (see below) |
| PATCH | `/api/contracts/:id/terminate` | admin, staff | `active → terminated`; cascades residency close + bed release + deposit settlement |
| GET | `/api/contracts/expiring` | admin, staff, viewer | Contracts expiring within N days — `?days=30` |

**PATCH `/api/contracts/:id/activate`**
```json
{ "code": "OK", "message": "Kích hoạt hợp đồng thành công",
  "data": {
    "contract": { "id": "665f4d...", "contractCode": "HD-2026-00042", "status": "active" },
    "invoices": [
      { "id": "665f5a...", "invoiceCode": "INV-202609-00101", "type": "deposit",
        "billingPeriod": null, "totalAmount": 500000, "dueDate": "2026-09-08" },
      { "id": "665f5b...", "invoiceCode": "INV-202609-00102", "type": "monthly",
        "billingPeriod": "2026-09", "totalAmount": 400000, "dueDate": "2026-09-08" }
    ]
  } }
```
> ⚠️ Returns an **array of two** invoices, not one. The deposit must stay a separate invoice — merging it into the monthly invoice causes that student's electricity and water for the period to never be billed (`DATA-SCHEMA.md` §3.10).

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
| GET | `/api/invoices` | admin, staff, viewer | List — `?studentId=&status=&billingPeriod=&type=` |
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

> Signature verification and idempotency live in `payment.service.js`; controllers only parse and delegate. Webhook routes are excluded from JWT auth but **must** pass gateway signature validation.

> 💡 **Local development:** the gateway cannot reach `localhost`, so the webhook will not fire on your machine. Test the three security cases above by calling the webhook endpoint directly from Postman — no tunnelling tool needed. Use `POST /api/payments/:id/reconcile` for transactions left `pending`.

---

## 9. Requests (Renewal/Checkout) — `modules/requests`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/requests` | admin, staff, viewer | Staff queue — `?status=pending&type=renewal` |
| GET | `/api/requests/:id` | admin, staff | Detail, including the student's outstanding debt |
| PATCH | `/api/requests/:id/approve` | admin, staff | Approve — cascades contract/residency/bed/deposit updates |
| PATCH | `/api/requests/:id/reject` | admin, staff | Reject — `{ reviewNote }` required |

**PATCH `/api/requests/:id/approve`** (type = `checkout`)
```json
// request
{ "actualCheckoutDate": "2026-12-15", "forceConfirm": true }
// response
{ "code": "OK", "message": "Duyệt trả phòng thành công",
  "data": {
    "request": { "id": "665f7a...", "status": "approved" },
    "settlement": {
      "outstandingDebt": 246000,
      "depositAmount": 500000,
      "refundAmount": 254000,
      "studentStillOwes": 0,
      "settlementInvoiceId": "665f9c..."
    }
  } }
// cascades: Contract.status='terminated', Residency.status='closed', Bed.status='available'
```
```json
{ "code": "STUDENT_HAS_DEBT", "message": "Sinh viên còn nợ 246.000 đ. Xác nhận vẫn duyệt?", "data": { "outstandingDebt": 246000 } } // 422
```
> Returned when `forceConfirm` is absent/false and the student still owes money *(PRD §2.9 A3)*. Staff re-sends with `forceConfirm: true` to proceed.

---

## 10. Student Portal — `modules/portal` (routes live in their feature modules)

All endpoints resolve the student from the **JWT**. Passing another student's id returns `403`.

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/portal/profile` | student | Own profile (read-only) |
| GET | `/api/portal/my-residence` | student | Current building/room/bed/contract + debt summary |
| GET | `/api/portal/my-contracts` | student | Current + historical contracts |
| GET | `/api/portal/my-invoices` | student | Own invoices |
| GET | `/api/portal/my-invoices/:id` | student | Own invoice detail with line items |
| GET | `/api/portal/my-payments` | student | Own payment history |
| GET | `/api/portal/my-requests` | student | Own renewal/checkout requests |
| POST | `/api/portal/my-requests` | student | Submit a renewal or checkout request |
| DELETE | `/api/portal/my-requests/:id` | student | Cancel own request while still `pending` |

**POST `/api/portal/my-requests`**
```json
{ "type": "renewal", "requestedEndDate": "2027-12-31", "reason": "Học tiếp kỳ sau" }
```
```json
{ "code": "DUPLICATE_PENDING_REQUEST", "message": "Bạn đã có một yêu cầu cùng loại đang chờ xử lý", "data": null } // 409
{ "code": "CONTRACT_NOT_ACTIVE", "message": "Bạn chưa có hợp đồng đang hiệu lực", "data": null }                  // 422
```

---

## 11. Dashboard — `modules/dashboard`

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/dashboard/occupancy` | admin, staff, viewer | Total/occupied/available beds, per building |
| GET | `/api/dashboard/summary` | admin, staff, viewer | Occupancy + total debt + overdue count + expiring contracts + pending requests |

**GET `/api/dashboard/occupancy`**
```json
{ "code": "OK", "message": "Success",
  "data": { "overall": { "total": 200, "occupied": 178, "available": 20, "maintenance": 2 },
            "byBuilding": [ { "buildingName": "Building B", "total": 50, "occupied": 45, "rate": 0.9 } ] } }
```
> ⚠️ Bed counts must always satisfy `total = occupied + available + maintenance`.

---

## 12. Error Codes Reference

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |
| `TOKEN_EXPIRED` | 401 | JWT expired — log in again |
| `FORBIDDEN` | 403 | Valid user, insufficient role, or accessing another student's data |
| `NOT_FOUND` | 404 | Resource does not exist |
| `ROOM_CAPACITY_EXCEEDED` | 409 | Room already at bed capacity |
| `BED_NOT_AVAILABLE` | 409 | Bed already occupied when creating a Residency |
| `DUPLICATE_ENTRY` | 409 | Unique index violation (e.g., `studentCode`, `email`) |
| `DUPLICATE_PENDING_REQUEST` | 409 | Student already has an open request of that type |
| `GENDER_MISMATCH` | 422 | Student gender does not match room gender *(A1)* |
| `STUDENT_HAS_ACTIVE_CONTRACT` | 422 | Student already has a `pending`/`active` contract |
| `STUDENT_HAS_DEBT` | 422 | Student still owes money |
| `CONTRACT_NOT_ACTIVE` | 422 | Operation requires an `active` contract |
| `BED_OCCUPIED` | 422 | Cannot set an occupied bed to maintenance |
| `INVOICE_ALREADY_PAID` | 422 | Invoice already fully paid |
| `INVOICE_HAS_PAYMENT` | 422 | Cannot cancel an invoice that has payments |
| `PAYMENT_EXCEEDS_REMAINING` | 422 | Payment larger than the outstanding balance |
| `INVALID_METER_READING` | 422 | End reading below start reading *(A2)* |
| `READING_ALREADY_INVOICED` | 422 | Meter reading locked after invoicing *(A2)* |
| `GATEWAY_SIGNATURE_INVALID` | 400 | VNPay/ZaloPay webhook signature check failed |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## 13. Notes for AI Coding Assistants

- When implementing an endpoint above, only the corresponding `modules/<feature>/` folder + `core/` + `shared/` should be needed as context (`ARCHITECTURE.md` §7).
- Controllers translate HTTP ↔ service calls only; put the business rules referenced here (capacity checks, gender check, status cascades, webhook idempotency, utility split) in `*.service.js`, not in the controller or route file.
- Cross-feature effects (Contract termination → Residency close → Bed release → deposit settlement) must go through the target feature's service function, never its model directly (`ARCHITECTURE.md` §3.4).
- Bed claiming uses an atomic conditional update, **not** read-then-write (`ARCHITECTURE.md` §3.5).

---

## 14. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 12/09/2026 | Initial API reference |
| 1.1 | 12/09/2026 | Added utility-reading endpoints and `GENDER_MISMATCH` (A1, A2); checkout approval now returns a `settlement` block (A3). Added password reset, invoice cancel, payment reconcile, and the full `/api/portal/*` group. Documented field-level validation error shape, the two-invoice contract activation, webhook behaviour table, and 11 new error codes. |
