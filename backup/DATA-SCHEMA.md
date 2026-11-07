# Data Schema

**Project:** Dormitory Management System
**Version:** 1.1
**Database:** MongoDB (Mongoose ODM)
**Audience:** Developers (new hires + AI coding assistants)

> This document defines **collections, fields, relationships, and business rules** at the data layer. Pair with `ARCHITECTURE.md` (folder structure) and `API.md` (endpoints). Every schema below maps to one `modules/<feature>/<entity>.model.js` file.
>
> Business rules are stated here at data level. Their full Vietnamese explanation, state machines and process flows live in `03-PHAN-TICH-NGHIEP-VU.md`.

---

## 1. Conventions

- **Primary key:** MongoDB default `_id` (ObjectId). Never expose custom IDs unless required by a business rule (e.g., student ID number is a separate field, not `_id`).
- **References:** store as `mongoose.Schema.Types.ObjectId` with `ref: '<Model>'`. Populate explicitly in the service layer — never `.populate()` blindly in controllers.
- **Timestamps:** every schema uses `{ timestamps: true }` → adds `createdAt` / `updatedAt` automatically. Do not hand-roll these fields.
- **Soft delete:** entities that must preserve history (Student, Contract, Invoice, Payment) use an `isActive: Boolean` or `status` field instead of hard deletes. Deactivation ≠ removal.
- **Enums:** defined once in `shared/constants/enums.js` and imported into schemas — never hardcode string literals in multiple files (avoids typos like `"Occupied"` vs `"occupied"`). **All enum values are lowercase.**
- **Money fields:** stored as **integers** (VND, smallest unit — no decimals in this currency), never floats.
- **Audit trail:** any status-changing action should be traceable via `createdAt`/`updatedAt` + the actor reference (`createdBy`/`updatedBy` where noted).

---

## 2. Entity Relationship Overview

```
User ──1:1── Student (optional link, only when role = student)
Building ──1:N── Room ──1:N── Bed
Room ──1:N── UtilityReading            (one per room per billing period)
Student ──1:N── Residency ──1:1── Bed  (current occupant, enforced unique+active)
Residency ──1:1── Contract
Contract ──1:N── Request               (renewal/checkout)
Student ──1:N── Invoice ──1:N── Payment
FeeType ──N:M── Invoice                (via invoice line items)
```

- A **Bed** can have many historical Residencies, but only **one active Residency** at a time (enforced at service layer + partial unique index).
- A **Contract** always belongs to exactly one Residency (1:1).
- An **Invoice** can receive multiple **Payments** (partial payments supported).

**11 collections:** `User`, `Student`, `Building`, `Room`, `Bed`, `Residency`, `Contract`, `FeeType`, `UtilityReading`, `Invoice`, `Payment`, `Request` — 12 counting `Request`.

---

## 3. Collections

### 3.1 `User` — `modules/auth/user.model.js`

Authentication identity. Every login (staff or student) is a `User`; `Student` profile is a separate collection linked via `userId`.

| Field | Type | Notes |
|---|---|---|
| `email` | String | unique, required, lowercase |
| `passwordHash` | String | required, bcrypt hash — never store plaintext |
| `fullName` | String | required, display name |
| `role` | String (enum) | `admin`, `staff`, `student`, `viewer` |
| `isActive` | Boolean | default `true`; disables login without deleting record |
| `mustChangePassword` | Boolean | default `false`; set `true` after a staff-issued password reset (`FR-09`) |
| `lastLoginAt` | Date | updated on successful login |

```js
const ROLES = ['admin', 'staff', 'student', 'viewer'];
```

**Indexes:** `{ email: 1 }` unique.
**Rule:** a `student`-role `User` must have exactly one corresponding `Student` document (`Student.userId` points back).

---

### 3.2 `Student` — `modules/students/student.model.js`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId ref `User` | unique sparse — set only when the student has a self-service account |
| `fullName` | String | required |
| `studentCode` | String | unique, required (school/enrollment ID, not `_id`) |
| `phone` | String | required |
| `email` | String | contact email (can differ from login email) |
| `dob` | Date | |
| `gender` | String (enum) | `male`, `female` — **required**, used by the room-gender check (A1) |
| `className` | String | |
| `faculty` | String | |
| `emergencyContact.name` | String | |
| `emergencyContact.phone` | String | |
| `emergencyContact.relationship` | String | |
| `status` | String (enum) | `active`, `inactive` (soft delete) |

**Indexes:** `{ studentCode: 1 }` unique, `{ fullName: 'text' }` for search.
**Rule:** cannot set `status: 'inactive'` while the student has an `active`/`pending` Contract or any unpaid Invoice.

---

### 3.3 `Building` — `modules/rooms/building.model.js`

| Field | Type | Notes |
|---|---|---|
| `code` | String | unique, required, e.g. `"A"` |
| `name` | String | required, e.g. `"Building A"` |
| `address` | String | |
| `description` | String | |
| `isActive` | Boolean | default `true` |

---

### 3.4 `Room` — `modules/rooms/room.model.js`

| Field | Type | Notes |
|---|---|---|
| `buildingId` | ObjectId ref `Building` | required |
| `roomNumber` | String | required, e.g. `"101"` |
| `gender` | String (enum) | **`male` / `female` — required.** *(Added 12/09/2026, PRD §2.9 A1.)* A student may only be assigned to a room whose `gender` matches theirs |
| `capacity` | Number | required — max beds allowed (also derivable from Bed count, kept denormalized for quick occupancy queries) |
| `pricePerBed` | Number | VND, **monthly rent for ONE bed** (i.e. per student), not for the whole room |
| `status` | String (enum) | `active`, `maintenance`, `inactive` |

**Indexes:** `{ buildingId: 1, roomNumber: 1 }` unique compound.
**Rules:**
- `capacity` must equal the count of `Bed` documents for this room — validated in `room.service.js` on bed create/delete.
- ⚠️ `pricePerBed` is the price **per student per month**. Do not multiply or divide it by `capacity` anywhere.

---

### 3.5 `Bed` — `modules/rooms/bed.model.js`

| Field | Type | Notes |
|---|---|---|
| `roomId` | ObjectId ref `Room` | required |
| `bedCode` | String | required, e.g. `"A-101-02"` (human-readable, denormalized for display) |
| `status` | String (enum) | `available`, `occupied`, `maintenance` |
| `note` | String | maintenance note |

```js
const BED_STATUS = ['available', 'occupied', 'maintenance'];
```

**Indexes:** `{ roomId: 1, bedCode: 1 }` unique compound.
**Rules:**
- Creating a Residency on a bed is only allowed when `Bed.status === 'available'`.
- ⭐ The claim **must** use an atomic conditional update, not read-then-write (`ARCHITECTURE.md` §3.5):
  ```js
  const bed = await Bed.findOneAndUpdate(
    { _id: bedId, status: 'available' },
    { status: 'occupied' },
    { new: true }
  );
  if (!bed) throw new ApiError(409, 'BED_NOT_AVAILABLE', 'Giường đã có người đăng ký');
  ```
- A bed with `status: 'occupied'` cannot be switched to `maintenance` — move the occupant out first.

---

### 3.6 `Residency` — `modules/residencies/residency.model.js`

Represents "student X occupies bed Y," independent of contract paperwork.

| Field | Type | Notes |
|---|---|---|
| `studentId` | ObjectId ref `Student` | required |
| `bedId` | ObjectId ref `Bed` | required |
| `startDate` | Date | required |
| `endDate` | Date | null while active |
| `status` | String (enum) | `active`, `closed` |
| `createdBy` | ObjectId ref `User` | staff who registered it |

**Indexes:** partial unique index — enforces one active occupant per bed at the DB level:
```js
residencySchema.index(
  { bedId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
```

**Rule:** closing a Residency (checkout approved) sets `status: 'closed'`, `endDate: now`, and triggers `bedService.markBedAvailable(bedId)`.

---

### 3.7 `Contract` — `modules/contracts/contract.model.js`

| Field | Type | Notes |
|---|---|---|
| `contractCode` | String | unique, auto-generated `HD-YYYY-XXXXX` |
| `residencyId` | ObjectId ref `Residency` | required, unique (1:1) |
| `studentId` | ObjectId ref `Student` | denormalized for query convenience |
| `bedId` | ObjectId ref `Bed` | denormalized for query convenience |
| `startDate` | Date | required |
| `endDate` | Date | required |
| `monthlyPrice` | Number | VND, **frozen at signing time** — later changes to `Room.pricePerBed` must not alter existing contracts |
| `depositAmount` | Number | VND, collected once at move-in. *(Used by A3 settlement.)* |
| `depositRefunded` | Number | VND, default `0` — amount actually paid back at checkout *(Added 12/09/2026, PRD §2.9 A3)* |
| `terms` | String | free text or file reference |
| `status` | String (enum) | `pending`, `active`, `expired`, `terminated` |
| `terminationReason` | String | filled when terminated early |

```js
const CONTRACT_STATUS = ['pending', 'active', 'expired', 'terminated'];
```

**Indexes:** `{ studentId: 1, status: 1 }`, `{ endDate: 1 }` (expiry-flag query), `{ residencyId: 1 }` unique.
**Rules:**
- A student may have at most **one** contract in `pending` or `active` at a time.
- A scheduled query flags contracts where `endDate - now <= 30 days AND status === 'active'` for the dashboard — no notification is sent (out of scope), only surfaced in-app.
- Deposit is charged **once** at contract start; renewing does not charge it again.

---

### 3.8 `FeeType` — `modules/fees/fee-type.model.js`

| Field | Type | Notes |
|---|---|---|
| `code` | String | unique, e.g. `rent`, `electricity`, `water`, `deposit`, `other` |
| `name` | String | required, Vietnamese display name, e.g. `"Tiền phòng"` |
| `unit` | String | e.g. `"tháng"`, `"kWh"`, `"m3"`, `"lần"` |
| `defaultAmount` | Number | VND — unit price used when generating invoices |
| `isRecurring` | Boolean | true for rent/utilities, false for one-off deposit |
| `isActive` | Boolean | default `true` |

**Seed values:** `rent`, `electricity` (2 500 đ/kWh), `water` (12 000 đ/m³), `deposit` (500 000 đ), `other`.

---

### 3.9 `UtilityReading` — `modules/fees/utility-reading.model.js`

*(Added 12/09/2026, PRD §2.9 A2.)* Meter readings per room per billing period. Without this collection there is no way to know how much electricity/water to charge.

| Field | Type | Notes |
|---|---|---|
| `roomId` | ObjectId ref `Room` | required |
| `billingPeriod` | String | required, e.g. `"2026-10"` |
| `electricityStart` | Number | meter reading at period start |
| `electricityEnd` | Number | must be `>= electricityStart` |
| `waterStart` | Number | |
| `waterEnd` | Number | must be `>= waterStart` |
| `electricityUnitPrice` | Number | VND/kWh — **frozen here**, copied from FeeType at entry time so later price changes do not alter past invoices |
| `waterUnitPrice` | Number | VND/m³ — same reasoning |
| `isInvoiced` | Boolean | default `false`; blocks editing once invoices are generated |
| `recordedBy` | ObjectId ref `User` | |

**Indexes:** `{ roomId: 1, billingPeriod: 1 }` unique compound.

**Rules:**
- End reading must be ≥ start reading — validated in the service and by a schema validator.
- Start reading of a period should default to the previous period's end reading.
- Cannot edit once `isInvoiced: true`.
- ⭐ **Even split with exact remainder** — the sum of per-student shares must equal the room total to the đồng:
  ```js
  // n = number of students with an active Residency in this room during the period
  const roomTotal = (electricityEnd - electricityStart) * electricityUnitPrice;
  const base = Math.floor(roomTotal / n);          // NOT Math.round — that overshoots
  const remainder = roomTotal - base * n;
  // the student with the smallest studentCode absorbs the remainder
  shares[0] = base + remainder;
  ```
  Example: 576 000 đ ÷ 7 → six students pay 82 285 đ, one pays 82 290 đ. Total = 576 000 đ exactly.
- If no student resides in the room during the period, skip it — generate no utility charge.

---

### 3.10 `Invoice` — `modules/fees/invoice.model.js`

| Field | Type | Notes |
|---|---|---|
| `invoiceCode` | String | unique, auto-generated `INV-YYYYMM-XXXXX` |
| `studentId` | ObjectId ref `Student` | required |
| `contractId` | ObjectId ref `Contract` | required — ties invoice to the residency period |
| `type` | String (enum) | `deposit`, `monthly`, `settlement`, `other` |
| `billingPeriod` | String | e.g. `"2026-10"`; `null` for `deposit`/`settlement` |
| `lineItems` | Array<`{ feeTypeId, description, quantity, unitPrice, amount }`> | required, min 1 |
| `totalAmount` | Number | sum of `lineItems.amount`, computed on save |
| `paidAmount` | Number | default `0`; **always recomputed** from successful Payments, never incremented blindly |
| `dueDate` | Date | required |
| `status` | String (enum) | `unpaid`, `partial`, `paid`, `overdue`, `cancelled` |

```js
const INVOICE_STATUS = ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'];
const INVOICE_TYPE = ['deposit', 'monthly', 'settlement', 'other'];
```

**Indexes:**
- `{ studentId: 1, billingPeriod: 1 }`, `{ status: 1, dueDate: 1 }` (overdue sweep)
- `{ invoiceCode: 1 }` unique
- Anti-duplicate, partial:
  ```js
  invoiceSchema.index(
    { studentId: 1, type: 1, billingPeriod: 1 },
    { unique: true, partialFilterExpression: { status: { $ne: 'cancelled' }, billingPeriod: { $type: 'string' } } }
  );
  ```

**Rules:**
- `status` is derived, never set by clients — recomputed from `paidAmount` vs `totalAmount` on every Payment write; a scheduled check flips `unpaid → overdue` once `dueDate` passes.
- Cancelling is only allowed when no successful Payment exists.
- ⚠️ **Do not merge the deposit into the first monthly invoice.** Issue **two** invoices when a contract is activated: one `type: 'deposit'` (`billingPeriod: null`) and one `type: 'monthly'`. Merging them makes the invoice occupy the `(student, monthly, period)` unique slot, so the end-of-period bulk generation skips that student entirely and **their electricity and water for that period are never billed**.
- When bulk generation finds an existing `monthly` invoice for the period, it **adds the missing line items** (electricity, water) to that invoice rather than skipping the student.

---

### 3.11 `Payment` — `modules/payments/payment.model.js`

| Field | Type | Notes |
|---|---|---|
| `transactionRef` | String | unique — our own reference, sent to the gateway |
| `invoiceId` | ObjectId ref `Invoice` | required |
| `studentId` | ObjectId ref `Student` | denormalized |
| `amount` | Number | required, VND, `> 0`. **Negative is not allowed** — refunds use `type: 'refund'` |
| `type` | String (enum) | `payment`, `refund` — `refund` used for deposit payout *(Added 12/09/2026, A3)* |
| `method` | String (enum) | `cash`, `bank_transfer`, `vnpay`, `zalopay` |
| `gatewayTransactionId` | String | required when `method` is `vnpay`/`zalopay`; null for offline |
| `gatewayRawResponse` | Mixed | raw webhook payload, stored for audit/reconciliation |
| `status` | String (enum) | `pending`, `success`, `failed`, `expired` |
| `paidAt` | Date | set when `status` becomes `success` |
| `recordedBy` | ObjectId ref `User` | staff who recorded it; null for online self-service payments |
| `note` | String | |

```js
const PAYMENT_METHOD = ['cash', 'bank_transfer', 'vnpay', 'zalopay'];
const PAYMENT_STATUS = ['pending', 'success', 'failed', 'expired'];
const PAYMENT_TYPE   = ['payment', 'refund'];
```

**Indexes:** `{ transactionRef: 1 }` unique, `{ gatewayTransactionId: 1 }` unique sparse (dedupe webhook retries), `{ invoiceId: 1 }`, `{ paidAt: 1 }`.

**Rules:**
- For gateway payments a `pending` Payment is created when checkout starts; the webhook flips it to `success`/`failed`. Only a `success` write triggers the `Invoice.paidAmount` recompute.
- **Idempotency:** before processing a webhook, check whether the Payment is already `success` — if so, acknowledge and do nothing. The unique index on `gatewayTransactionId` is the backstop.
- Payment amount may not exceed the invoice's outstanding balance.

---

### 3.12 `Request` — `modules/requests/request.model.js`

Renewal or checkout requests submitted by students.

| Field | Type | Notes |
|---|---|---|
| `studentId` | ObjectId ref `Student` | required |
| `contractId` | ObjectId ref `Contract` | required |
| `type` | String (enum) | `renewal`, `checkout` |
| `reason` | String | student-provided free text |
| `requestedEndDate` | Date | new end date (renewal) or move-out date (checkout) |
| `status` | String (enum) | `pending`, `approved`, `rejected`, `cancelled` |
| `reviewedBy` | ObjectId ref `User` | staff who approved/rejected |
| `reviewNote` | String | required when rejecting |
| `reviewedAt` | Date | |

```js
const REQUEST_TYPE = ['renewal', 'checkout'];
const REQUEST_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];
```

**Indexes:**
- `{ status: 1, type: 1 }` (staff queue query)
- One open request of each type per contract, partial:
  ```js
  requestSchema.index(
    { contractId: 1, type: 1 },
    { unique: true, partialFilterExpression: { status: 'pending' } }
  );
  ```

**Rules on approval:**
- `renewal` → `Contract.endDate` extended; monthly invoices generated for the new periods; **deposit is not charged again**.
- `checkout` → `Contract.status = 'terminated'`, `Residency.status = 'closed'`, `Bed.status = 'available'`, plus **deposit settlement** (below).

---

## 4. Deposit Settlement on Checkout *(Added 12/09/2026, PRD §2.9 A3)*

When a checkout request is approved, the system closes out the contract financially:

```
outstandingDebt = Σ (totalAmount − paidAmount) of the student's invoices
                  with status ∈ {unpaid, partial, overdue}

refund = depositAmount − outstandingDebt
```

| Result | What happens |
|---|---|
| `refund > 0` | Create a `settlement` Invoice summarising the closeout, and a `Payment` with `type: 'refund'`, `status: 'success'`, `amount: refund`, recording who paid it back and when. Set `Contract.depositRefunded = refund`. |
| `refund <= 0` | The deposit is fully consumed. Create a `settlement` Invoice for the remaining `|refund|` the student still owes. `Contract.depositRefunded = 0`. |

⚠️ Computing the number is not enough — the **payout must be recorded** as a `Payment` document. Otherwise there is no way to answer "did we actually give this student their deposit back?"

---

## 5. Cross-Entity Business Rules Summary

| Rule | Enforced in |
|---|---|
| No double-booking a bed | atomic `findOneAndUpdate` in `bed.service.js` + partial unique index on `Residency.bedId` |
| No mixed-gender room *(A1)* | `residency.service.js` — compares `Student.gender` with `Room.gender` |
| Room capacity = bed count | `room.service.js`, validated on bed CRUD |
| One open contract per student | `contract.service.js` pre-check |
| Contract 1:1 Residency | unique index on `Contract.residencyId` |
| Invoice status derived, not client-set | `invoice.service.js`, recomputed on every Payment write |
| Deposit invoice separate from monthly | `contract.service.js` on activation — two invoices, never one |
| Utility split sums exactly *(A2)* | `invoice.service.js` — `Math.floor` + remainder to the smallest `studentCode` |
| Deposit settled at checkout *(A3)* | `request.service.js` on checkout approval |
| Gateway webhook idempotency | status pre-check + unique sparse index on `Payment.gatewayTransactionId` |
| One pending request per type per contract | partial unique index on `Request` |

---

## 6. Example: Full Mongoose Schema Skeleton

Use this shape for every new entity — see `ARCHITECTURE.md` §3.2 for file placement.

```js
// modules/rooms/bed.model.js
const mongoose = require('mongoose');
const { BED_STATUS } = require('../../shared/constants/enums');

const bedSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    bedCode: { type: String, required: true, trim: true },
    status: { type: String, enum: BED_STATUS, default: 'available' },
    note: { type: String },
  },
  { timestamps: true }
);

bedSchema.index({ roomId: 1, bedCode: 1 }, { unique: true });

module.exports = mongoose.model('Bed', bedSchema);
```

---

## 7. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 12/09/2026 | Initial schema, 9 collections |
| 1.1 | 12/09/2026 | Added `Room.gender` (A1), `UtilityReading` collection (A2), `Contract.depositRefunded` + `Payment.type` + §4 settlement (A3). Added `invoiceCode`/`contractCode`/`transactionRef`, invoice `type` and `cancelled` status, `User.fullName`/`mustChangePassword`. Documented the deposit-invoice separation trap, the atomic bed claim, and concrete `partialFilterExpression` index definitions. |
