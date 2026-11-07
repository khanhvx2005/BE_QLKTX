# Project Architecture Overview
**Project:** Dormitory Management System
**Version:** 1.2
**Pattern:** Modular Monolith — Feature-Based (Vertical Slice) Organization
**Audience:** Developers (new hires + AI coding assistants)

> This document defines **how the codebase is organized**, not what each feature does. See `PRD.md` for feature scope. Every new feature (Student, Room/Bed, Residency/Contract, Fee/Payment, Auth, Dashboard, Renewal/Checkout Request) must follow the structure described here.

> **📦 Two repositories.** The project lives in two GitHub repos; all five team members have access to both.
>
> | Repo | Contents | Primary owners |
> |------|----------|----------------|
> | `FE_QuanLyKTX` | React + Vite app · **plus the whole `docs/` folder** | 2 frontend members |
> | `BE_QuanLyKTX` | Node.js + Express + Mongoose API | 3 backend members |
>
> Documentation is **not duplicated** — `BE_QuanLyKTX/README.md` links to `docs/` in the frontend repo. Two copies would diverge within days.

---

## 1. Guiding Principles

- **Feature-based, not layer-based at the top level.** Group code by business domain (`students`, `rooms`, `contracts`...) instead of by technical type (`controllers/`, `models/`) at the root — this scales better with a 5-person team working in parallel.
- **Each feature is a self-contained module** with its own routes/controllers/services/models (backend) or components/hooks/api (frontend). Features should be as decoupled as possible.
- **Shared code lives in a `common`/`core` layer** — never duplicated across features, never reached into directly from one feature into another feature's internals.
- **One-way dependency rule:** `feature → shared/core` is allowed. `feature → feature` is discouraged (use shared services or events instead).
- **Monolith today, extractable tomorrow.** Feature boundaries are drawn so that, if needed later, a feature (e.g., `payments`) could be lifted into its own service with minimal rewrite.

---

## 2. High-Level System Diagram

```
┌─────────────────────────┐      HTTPS/JSON       ┌──────────────────────────┐
│   Frontend (React+Vite) │ ─────────────────────► │  Backend (Express API)   │
│   Feature-based SPA     │ ◄───────────────────── │  Feature-based Monolith  │
└─────────────────────────┘                        └───────────┬──────────────┘
                                                               │ Mongoose ODM
                                                               ▼
                                                     ┌──────────────────┐
                                                     │     MongoDB       │
                                                     └──────────────────┘
                                                               ▲
                                                               │ webhook callback
                                                   VNPay / ZaloPay Gateway
```

---

## 3. Backend Architecture (Express + Mongoose)

### 3.1 Root Structure

```
backend/
├── src/
│   ├── modules/                # feature-based modules (business domain)
│   │   ├── auth/
│   │   ├── students/
│   │   ├── rooms/              # buildings + rooms + beds
│   │   ├── residencies/
│   │   ├── contracts/
│   │   ├── fees/               # fee types + utility readings + invoices
│   │   ├── payments/
│   │   ├── requests/           # renewal/checkout requests
│   │   └── dashboard/
│   ├── core/                   # cross-cutting infrastructure
│   │   ├── config/             # env, db connection, app config
│   │   ├── middlewares/        # auth guard, error handler, validator
│   │   ├── errors/             # custom error classes
│   │   ├── utils/              # pure helper functions
│   │   └── logger/
│   ├── shared/                 # shared reusable business pieces
│   │   ├── constants/          # enums: role, status, etc.
│   │   └── types/ (or jsdoc)   # shared DTO shapes
│   ├── app.js                  # express app assembly (mounts modules)
│   └── server.js               # entry point
├── tests/
└── package.json
```

### 3.2 Inside Each Feature Module

Each module is a self-contained vertical slice:

```
modules/students/
├── student.model.js         # Mongoose schema
├── student.routes.js        # Express router for this feature
├── student.controller.js    # HTTP layer: parse req, call service, format res
├── student.service.js       # business logic (validation, orchestration)
├── student.validation.js    # request schema validation
└── student.routes.test.js
```

- **Routes** register endpoints and delegate to controllers only.
- **Controllers** never contain business logic — only I/O translation.
- **Services** hold business rules (e.g., "room cannot exceed bed capacity").

> **📌 v1 simplification (12/09/2026).** The original design also listed a `*.repository.js` layer. **We do not use it.** Mongoose models are already a data-access abstraction; adding a repository on top produces pass-through code with no benefit at this team size. Services call Mongoose models directly. If a module ever grows complex enough to justify one, add it to that module only.

### 3.3 Module Registration (keeps `app.js` thin)

```js
// app.js
const studentRoutes = require('./modules/students/student.routes');
const roomRoutes = require('./modules/rooms/room.routes');

app.use('/api/students', studentRoutes);
app.use('/api/rooms', roomRoutes);
```

### 3.4 Cross-Feature Communication

- If `contracts` needs to update `rooms` (bed status), call the **room service function** directly (`bedService.markBedAvailable(bedId)`), not the room model. This keeps data access private to each module.
- Avoid circular imports between modules — if two features need to share logic, extract it into `shared/`.

### 3.5 ⚠️ Atomicity without MongoDB transactions

**MongoDB transactions require a replica set.** A plain local `mongod` cannot run `session.startTransaction()` — it fails at runtime. Rather than force every developer to configure a replica set, v1 uses **atomic conditional updates**, which are a native single-document guarantee in MongoDB and need no transaction at all.

```js
// Claim a bed — atomic. Two simultaneous requests: only one gets a document back.
const bed = await Bed.findOneAndUpdate(
  { _id: bedId, status: 'available' },   // the condition lives in the query
  { status: 'occupied' },
  { new: true }
);
if (!bed) {
  throw new ApiError(409, 'BED_NOT_AVAILABLE', 'Bed is no longer available');
}
```

This is the mechanism that prevents double-booking. A **partial unique index** on `Residency` (see `DATA-SCHEMA.md` §3.6) backs it up as a second line of defense.

**When a real transaction is genuinely needed** (checkout approval touches Request + Contract + Residency + Bed + Invoice), either:
1. Use **MongoDB Atlas** (free tier is a replica set) — recommended, and needed for deployment anyway; or
2. Run local MongoDB as a single-node replica set: `mongod --replSet rs0` then `rs.initiate()`; or
3. Order the writes so the **riskiest one happens first** and later failures are recoverable by re-running — acceptable for v1.

Whichever is chosen, write it down in `13-LO-TRINH-TRIEN-KHAI.md` so the whole team sets up the same way.

---

## 4. Frontend Architecture (React + Vite)

### 4.1 Root Structure

```
frontend/
├── src/
│   ├── features/                 # feature-based modules
│   │   ├── auth/
│   │   ├── students/
│   │   ├── rooms/
│   │   ├── residencies/
│   │   ├── contracts/
│   │   ├── fees/
│   │   ├── payments/
│   │   ├── requests/
│   │   ├── dashboard/
│   │   └── portal/               # student self-service screens
│   ├── components/               # shared/dumb UI components (StatusTag, MoneyText...)
│   ├── layouts/                  # AdminLayout, PortalLayout
│   ├── routes/                   # route definitions, role guards
│   ├── lib/                      # axios instance, config
│   ├── hooks/                    # shared cross-feature hooks (useApi, useDebounce)
│   ├── context/                  # global state (auth session)
│   ├── utils/                    # formatters, permission helper
│   ├── constants/                # roles, statuses, routes
│   ├── App.jsx
│   └── main.jsx
├── public/
└── package.json
```

### 4.2 Inside Each Feature Folder

```
features/students/
├── api/
│   └── student.api.js         # axios calls to /api/students
├── components/
│   ├── StudentTable.jsx
│   └── StudentFormModal.jsx
├── pages/
│   └── StudentsPage.jsx       # route-level page, composes components
└── index.js                   # public exports of this feature
```

- Only `index.js`/exported members should be imported by other features or routes — internal files are private to the feature.
- Each feature owns its own API calls and components; no shared "god" API file.

> **📌 v1 simplification (12/09/2026).** Two departures from the original sketch, both to reduce file count for a small team:
> 1. **No per-feature `hooks/` folder** unless a feature actually needs one. Data fetching goes through the shared `hooks/useApi.js`; a one-line `useApi(() => studentApi.getList(filters), [filters])` inside the page is enough.
> 2. **Create/edit forms are modals inside the list page**, not separate routed pages. This removes ~11 screens and ~11 routes across the project.

### 4.3 Role-Based Access (Frontend)

- `routes/` defines guarded routes per role (`admin`, `staff`, `student`, `viewer`).
- Student self-service pages live under `features/portal/` with their own `PortalLayout`.
- ⚠️ Frontend guards are **UX only, never security**. Every endpoint re-checks the role server-side (`API.md` §1.3).

---

## 5. Cross-Cutting Concerns

| Concern | Where it lives | Example |
|---|---|---|
| Auth/session | `core/middlewares/auth.js` (BE), `context/AuthContext` + route guards (FE) | JWT verify middleware, `RoleRoute` |
| Error handling | `core/errors/` + global error middleware (BE), axios interceptor (FE) | Consistent `{ code, message, data }` response shape |
| Validation | `*.validation.js` per module (BE), antd `Form` `rules` per feature (FE) | One validation file per entity |
| Environment config | `core/config/` | `.env` → `config.js` single source |
| Logging | `core/logger/` | Request logging middleware, `[AUDIT]` action lines |
| Status enums (bed/contract/invoice) | `shared/constants/enums.js` (BE), `constants/statuses.js` (FE) | Single source of truth to avoid string typos across modules |

---

## 6. Naming & Conventions

- **Files:** `kebab-case` for plain JS files (`student.service.js`, `use-api.js`); `PascalCase.jsx` for React component files (`StudentsPage.jsx`).
- **Code:** `PascalCase` for React components and classes, `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for constants.
- **Enum values are lowercase strings** (`'active'`, `'admin'`, `'available'`) — matches MongoDB convention used throughout `DATA-SCHEMA.md`.
- **REST endpoints:** `/api/<feature>` (plural), nested only where hierarchy is genuinely needed (e.g., `/api/rooms/:roomId/beds`).
- **Mongoose schema file** = `<entity>.model.js`; one collection per core entity.
- Every module exposes a single entry point (`index.js` or `*.routes.js`) — no reaching into another module's internal files.
- **Git branches and commit messages are in English**; UI strings and code comments are in Vietnamese. See `10-QUY-TRINH-LAM-VIEC.md`.

---

## 7. Scalability Path (Future-Proofing)

- Because each backend module is self-contained (own model/service/routes), a high-load feature like `payments` (gateway webhooks) can later be **extracted into a separate service** without touching other modules — only its route mount point changes.
- Adding a new feature = adding a new folder under `modules/` (BE) and `features/` (FE) + one route registration line — no existing code is modified.
- This structure also keeps AI coding assistants scoped: when asked to work on "payments," the assistant only needs context from `modules/payments/` + `shared/`, not the entire codebase.

---

## 8. Next Steps

1. Scaffold `backend/` root structure above. *(Frontend is already scaffolded — see `README.md` §5.)*
2. Set up `core/config`, DB connection, and `app.js` module registration skeleton (backend).
3. Implement modules in PRD priority order: `auth` → `students` → `rooms` (Building/Room/Bed) → `residencies`/`contracts` → `fees`/`payments` → `requests` → `dashboard`.
4. Build **one module end to end first** (`students`), verify it works, then clone the structure for the rest. See `14-PHIEN-BAN-DON-GIAN-HOA.md` §15.

---

## 9. Environment Variables

### 9.1 Backend — `backend/.env`

```bash
# --- App ---
NODE_ENV=development
PORT=5000

# --- Database ---
# Atlas:  mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/dms_ktx?retryWrites=true&w=majority
# Local:  mongodb://localhost:27017/dms_ktx
MONGODB_URI=mongodb://localhost:27017/dms_ktx

# --- Auth ---
# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10

# --- Security ---
CORS_ORIGIN=http://localhost:5173

# --- VNPay sandbox ---
VNP_TMN_CODE=
VNP_HASH_SECRET=
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=http://localhost:5173/portal/payment-result

# --- Scheduler ---
ENABLE_CRON=true
TZ=Asia/Ho_Chi_Minh
```

### 9.2 Frontend — `frontend/.env`

```bash
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME=He thong quan ly ky tuc xa
VITE_USE_MOCK=false
```

> ⚠️ `.env` **must never be committed** — it is in `.gitignore`. Commit `.env.example` with every key present but every value blank, so a new team member knows what to configure.
>
> ⚠️ The **database name must be in the URI path** (`/dms_ktx` before the `?`). Without it Mongoose silently writes to a database called `test`.

---

## 10. MongoDB Connection

`core/config/database.js` — connect once at startup, fail fast if it cannot.

```js
const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[DB] Missing MONGODB_URI in .env');
    process.exit(1);
  }

  // Mongoose 8 needs no legacy options (useNewUrlParser, useUnifiedTopology)
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,   // fail in 10s instead of hanging
      maxPoolSize: 10,
    });
    console.log(`[DB] MongoDB connected → ${mongoose.connection.name}`);
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    process.exit(1);   // do not start the server without a database
  }

  mongoose.connection.on('disconnected', () => console.warn('[DB] MongoDB disconnected'));
  mongoose.connection.on('error', (e) => console.error('[DB] MongoDB error:', e.message));
}

module.exports = { connectDatabase };
```

```js
// server.js
const app = require('./app');
const { connectDatabase } = require('./core/config/database');
const { startJobs } = require('./core/jobs/daily-job');

(async () => {
  await connectDatabase();          // connect BEFORE listening
  startJobs();
  app.listen(process.env.PORT || 5000, () =>
    console.log(`[APP] Listening on ${process.env.PORT || 5000}`));
})();
```

> 💡 The log line prints `mongoose.connection.name` — the actual database being used. If it says `test`, the URI is missing the database name.

### 10.1 Index creation

Mongoose builds the indexes declared in each schema automatically on first connect — **there is no migration step**. Two consequences:

1. Index creation is **asynchronous**. In development, verify with `db.<collection>.getIndexes()` in `mongosh` or Compass rather than assuming.
2. Changing an index definition does **not** drop the old one. On a development database, drop the collection and let it rebuild; on production, drop the stale index explicitly.

```js
// Verify the two indexes that protect core business rules
db.residencies.getIndexes()   // { bedId: 1 } unique, partialFilterExpression: { status: 'active' }
db.invoices.getIndexes()      // { studentId, type, billingPeriod } unique partial
```

---

## 11. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 12/09/2026 | Initial architecture |
| 1.2 | 12/09/2026 | Added §9 Environment Variables and §10 MongoDB Connection: connection helper with fail-fast startup, the database-name-in-URI pitfall, and how Mongoose builds indexes without migrations. |
| 1.1 | 12/09/2026 | Dropped the optional repository layer and per-feature hooks folder (v1 simplification). Added §3.5 on achieving atomicity without MongoDB transactions. Added `portal` frontend feature. Clarified naming: lowercase enum values, English branches/commits, Vietnamese UI/comments. |
