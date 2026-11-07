# Product Requirements Document (PRD)
**Project:** Dormitory Management System
**Version:** 1.1 (MVP)
**Architecture:** Monolith
**Stack:** React + Vite (Frontend) · Node.js + Express.js, npm (JavaScript) (Backend) · MongoDB + Mongoose (Database)
**Team size:** 5
**Audience:** Developers (new hires + AI coding assistants)

> **Purpose of this document:** Define the exact scope of v1. Anything not listed under "Core Features" is NOT part of this release. AI coding assistants and developers should treat "Out of Scope" as a hard boundary — do not implement, scaffold, or suggest those features unless this document is updated first.

> **📌 Document set map.** This PRD is the scope contract. It is paired with:
> - `ARCHITECTURE.md` — how the code is organized
> - `API.md` — endpoint contract
> - `DATA-SCHEMA.md` — collections and fields
> - `01`–`11` (Vietnamese) — business analysis, UI design, planning, testing, deployment
>
> See `README.md` for the full map. **Where this PRD and any Vietnamese document disagree about scope, this PRD wins.**

---

## 1. Problem Statement

Dormitory administrators currently manage students, room/bed assignments, contracts, and fee collection using manual methods (paper records, spreadsheets, or disconnected tools). This causes:

- **No single source of truth** — student, room, and payment data live in separate files, causing mismatches (e.g., a room marked "empty" in one sheet but occupied in another).
- **Slow information retrieval** — finding "which students haven't paid this month" or "which beds are free in Building A" takes manual cross-referencing.
- **Error-prone occupancy tracking** — double-booking a bed, or losing track of contract expiry dates, happens due to lack of automated validation.
- **No audit trail** — no reliable history of who registered, when a contract was signed, or when a payment was made.

**Goal of the system:** Provide a centralized, monolithic web application that automates student residency management — from room/bed assignment, to contract lifecycle, to fee tracking — with real-time occupancy visibility for dormitory staff.

---

## 2. Core Features (MVP)

### 2.1 Student Management
- Create / view / update / deactivate student profiles (name, ID number, contact info, emergency contact).
- Search & filter students (e.g., by name, room, status: active/inactive).
- Example: Admin searches "Nguyen" → sees list of matching students with current room assignment.

### 2.2 Room & Bed Management
- CRUD for **Buildings → Rooms → Beds** (hierarchical structure).
- Track bed status: `available`, `occupied`, `maintenance`.
- Room capacity validation (cannot assign more students than beds available).
- **Room gender** — each room is designated `male` or `female`; the system blocks assigning a student whose gender does not match the room. *(Added 12/09/2026 by team decision — see §2.9 A1.)*
- Example: Room `A-101` has 4 beds; system blocks a 5th assignment and shows "Room full."

### 2.3 Residency Registration & Contracts
- Register a student into a specific bed (creates a `Residency` record).
- Generate/store a **Contract** (start date, end date, terms, linked student + bed).
- Contract lifecycle: `pending → active → expired/terminated`.
- Auto-flag contracts expiring within N days (e.g., 30 days) for renewal follow-up.
- Example: Contract for student X in bed `A-101-02` runs 2026-09-01 → 2027-06-30; system flags it on 2027-05-31.

### 2.4 Fees & Payments
- Define fee types (e.g., monthly rent, electricity, water, deposit).
- Generate invoices per student/room per billing cycle.
- Record payments (full/partial) against invoices; track payment status: `unpaid`, `partial`, `paid`, `overdue`.
- **Utility meter readings** — staff enter start/end electricity and water meter readings per room per billing period; the system computes consumption, multiplies by unit price, and splits the cost evenly across students currently residing in that room. *(Added 12/09/2026 by team decision — see §2.9 A2.)*
- **Deposit settlement** — when a checkout is approved, the system computes `refund = deposit − outstanding debt` and records the refund payout. *(Added 12/09/2026 by team decision — see §2.9 A3.)*
- **Online payment gateway integration**: students pay monthly fees directly via **VNPay** and **ZaloPay**.
  - System creates a payment request/transaction with the gateway and redirects the student (or shows QR code).
  - Gateway callback/webhook updates invoice status automatically (`paid`) upon confirmed transaction.
  - Staff can still record manual/offline payments (cash, bank transfer) as a fallback.
- Example: Student clicks "Pay now" on October rent invoice → redirected to VNPay checkout → on success, invoice auto-updates to `paid` and a payment record is created with transaction ID.

### 2.5 Occupancy Monitoring & Reporting
- Dashboard: total beds, occupied/available count, occupancy rate per building.
- List view: overdue payments, expiring contracts, vacant beds.
- Example: Dashboard shows "Building B: 45/50 beds occupied (90%)."

### 2.6 User Authentication & Roles
- Login/logout (session-based or JWT).
- Roles: `admin` (full access), `staff` (manage students/rooms/payments), `student` (self-service, own data only), `viewer` (read-only reports).
- Example: A `viewer` role can see occupancy reports but cannot edit contracts.

### 2.7 Student Self-Service Portal
- Students can **register an account** and **log in** (separate from staff/admin accounts, same auth system with `student` role).
- Students can **view available rooms/beds** (read-only: building, room, capacity, remaining slots, price).
- Students can view **their own profile, current residency, contract, and invoice/payment history**.
- Students can **pay invoices online** via VNPay/ZaloPay (see 2.4).
- Access is scoped strictly to the student's own data (cannot view other students' info).
- Example: Student logs in → sees "Room A-101, Bed 02 — Active until 2027-06-30" and an "Outstanding: 200,000 VND" invoice with a "Pay now" button.

### 2.8 Room Renewal & Checkout Requests
- Students can submit a **renewal request** for their current contract before it expires.
- Students can submit a **checkout (move-out) request** for their current bed/contract.
- Requests enter a `pending` state and appear in a staff queue for **approval/rejection**.
- On approval:
  - Renewal → contract end date extended, new contract term created.
  - Checkout → contract set to `terminated`, residency closed, bed status reverts to `available`, **deposit settled** (see 2.4).
- Students can track the status of their request (`pending`, `approved`, `rejected`).
- Example: Student submits "Renew for 1 more semester" → Staff reviews and approves → contract extended to 2027-12-31, student notified in-app.

### 2.9 Additions to v1.0 (team decision, 12/09/2026)

Three business rules were kept from the team's earlier Vietnamese specification because dropping them would leave real gaps. Each is small in effort but closes a hole that is hard to patch later.

| # | Addition | Why it is needed | Effort |
|---|---|---|---|
| **A1** | **Room gender** (`Room.gender`) | Without it the system happily assigns a male student to a room holding seven female students. Cheapest possible fix: one enum field + one check in the service. | ~0.5 day |
| **A2** | **Utility meter readings + even split** | Electricity/water are listed as fee types, but with no meter reading there is no way to know the amount. Staff would have to compute by hand outside the system, defeating the purpose. | ~1.5 days |
| **A3** | **Deposit settlement on checkout** | A deposit is collected at move-in but nothing closes it out at move-out. Without settlement the financial lifecycle of a contract never completes and the books cannot be reconciled. | ~1 day |

These are **in scope for v1**. They are marked inline throughout this document set with the tag *(Added 12/09/2026)*.

---

## 3. Out of Scope (NOT in v1)

Explicitly excluded — do not build unless this PRD is revised:

- ❌ Mobile native app (iOS/Android) — web-responsive only. Student self-service is web-based (see 2.7).
- ❌ Payment gateways other than **VNPay** and **ZaloPay** (e.g., Momo, Stripe) — only these two are integrated in v1.
- ❌ Student self-service for editing profile/personal info beyond viewing (e.g., changing name, ID number) — students can view data, submit renewal/checkout requests, and pay invoices, but profile edits still require staff.
- ❌ Multi-dormitory / multi-tenant support (system manages **one** dormitory organization only).
- ❌ Automated notifications (email/SMS reminders for payment/contract expiry) — v1 only shows flags in the dashboard.
  - Consequence: a user who forgets their password cannot self-recover. Staff reset the password manually and hand over a one-time temporary password (SRS `FR-09`).
- ❌ Maintenance/repair ticketing system for rooms.
- ❌ Visitor/guest check-in tracking.
- ❌ Advanced analytics/BI (trend forecasting, predictive occupancy).
- ❌ Multi-language support (English/Vietnamese UI toggle) — single language UI in v1. **UI text is Vietnamese.**
- ❌ Document e-signature for contracts (contracts stored as records/files, not digitally signed).
- ❌ Moving a student between beds/rooms mid-contract ("room transfer"). To change rooms, terminate the contract and create a new one.
- ❌ Bulk import of students from Excel/CSV. Data is entered by hand or through the seed script.

---

## 4. Main User Flows

### 4.1 Flow: Register a New Student into a Room
1. Staff logs in → navigates to **Students** → **Add New Student**.
2. Fills student profile → saves.
3. Navigates to **Room Management** → selects an available bed **in a room matching the student's gender**.
4. Creates **Residency Registration**, linking student to bed.
5. System generates a **Contract** (draft) → staff fills terms → sets status `active`.
6. Bed status auto-updates to `occupied`.

### 4.2 Flow: Monthly Fee Collection
1. Staff enters **utility meter readings** for each room for the billing period.
2. Admin/Staff triggers **Generate Invoices** for the billing cycle (per room/student).
3. System creates `unpaid` invoices: monthly rent + the student's even share of electricity and water.
4. Student pays (online or offline) → invoice status updates (`partial`/`paid`).
5. Overdue invoices (past due date, still `unpaid`) are flagged automatically.

### 4.3 Flow: Contract Renewal / Termination
1. System flags contracts nearing expiry (dashboard alert).
2. Staff opens contract → chooses **Renew** (extends end date, creates new contract term) or **Terminate**.
3. On termination: Residency record closed → bed status reverts to `available` → deposit settled.

### 4.4 Flow: Occupancy Check
1. Staff/Admin opens **Dashboard**.
2. Views real-time counts: total/occupied/available beds, per building/room.
3. Drills into a specific room to see current occupant(s) and contract status.

### 4.5 Flow: Student Self-Service — View Room & Pay Online
1. Student registers/logs in with `student` role.
2. Views **Available Rooms** (browse-only) or **My Residency** (own current room/bed/contract).
3. Opens **My Invoices** → selects an unpaid invoice → clicks **Pay now**.
4. Redirected to VNPay/ZaloPay → completes payment.
5. Gateway callback confirms transaction → invoice status auto-updates to `paid`; student sees updated status in-app.

### 4.6 Flow: Student Requests Renewal or Checkout
1. Student opens **My Contract** → clicks **Request Renewal** or **Request Checkout**.
2. Fills a short reason/form (e.g., desired new end date, move-out date) → submits.
3. Request enters `pending` status in the **Staff Requests Queue**.
4. Staff reviews → **Approves** or **Rejects** (with optional note).
5. On approval: system updates contract/residency/bed status automatically (per 2.8); for checkout it also settles the deposit; student sees final status in-app.

---

## 5. Success Criteria (v1)

- Staff can fully manage a student's lifecycle (register → assign bed → contract → payments → checkout) without leaving the system.
- Students can self-serve: view their room/contract, browse available rooms, pay fees online, and request renewal/checkout without contacting staff directly.
- Online payments via VNPay/ZaloPay reconcile automatically with invoice status (no manual staff entry needed for online transactions).
- Occupancy data (available/occupied beds) is always accurate and real-time.
- **No double-booking of beds is possible** (enforced by system validation).
- **No mixed-gender room assignment is possible** (enforced by system validation).
- Utility charges are computed from meter readings, and the sum of the per-student shares always equals the room total exactly.
- All core entities (Student, Building, Room, Bed, Residency, Contract, FeeType, UtilityReading, Invoice, Payment, Request) are covered by CRUD operations.

---

## 6. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 12/09/2026 | Initial PRD |
| 1.1 | 12/09/2026 | Added §2.9 — three business rules carried over from the team's earlier specification: room gender (A1), utility meter readings with even split (A2), deposit settlement on checkout (A3). Added explicit out-of-scope entries for room transfer and bulk import. Clarified that no e-mail means staff-driven password reset. |
