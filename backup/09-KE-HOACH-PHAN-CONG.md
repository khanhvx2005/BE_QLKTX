# 09 – KẾ HOẠCH & PHÂN CÔNG CÔNG VIỆC

**Hệ thống:** DMS-KTX
**Phiên bản:** v1.0
**Thời lượng dự án:** 12 tuần · **Phiên bản:** v2.0
**Khối lượng:** ~155 ngày công (đã áp dụng [v1-lite](14-PHIEN-BAN-DON-GIAN-HOA.md))

> Tài liệu này trả lời câu hỏi **"ai làm gì"**. Câu hỏi **"làm vào lúc nào và làm thế nào"** nằm ở `13-LO-TRINH-TRIEN-KHAI.md`.

---

## 1. Cơ cấu nhóm và vai trò

> ⚠️ Điền tên thật của thành viên vào cột "Người đảm nhận" trước khi nộp báo cáo.

| # | Vai trò | Người đảm nhận | Trách nhiệm chính | Repo chính |
|---|---------|----------------|-------------------|------------|
| 1 | **Backend Lead** *(kiêm Nhóm trưởng / PM)* | _(điền tên)_ | Thiết kế schema Mongoose, khởi tạo dự án BE, xác thực & phân quyền, module `residencies`/`contracts`, review code BE. Kiêm: lập kế hoạch, theo dõi tiến độ, chủ trì họp, báo cáo GVHD | `BE_QuanLyKTX` |
| 2 | **Backend Dev 1** | _(điền tên)_ | Module `students`, `rooms` (building/room/bed), `dashboard` | `BE_QuanLyKTX` |
| 3 | **Backend Dev 2** | _(điền tên)_ | Module `fees` (chỉ số điện nước + hóa đơn), `payments` (VNPay), `requests`, cron job | `BE_QuanLyKTX` |
| 4 | **Frontend Lead** *(kiêm BA)* | _(điền tên)_ | Khung nền FE, layout, routing, phân quyền, dashboard, review code FE. Kiêm: duy trì tài liệu `01`–`03`, làm rõ yêu cầu, viết test case, nghiệm thu UAT | `FE_QuanLyKTX` |
| 5 | **Frontend Dev** | _(điền tên)_ | Các màn hình CRUD, màn hình tài chính, cổng sinh viên, responsive | `FE_QuanLyKTX` |

### 1.1. Vì sao chia 3 backend / 2 frontend

Đối chiếu với WBS ở mục 3, khối lượng nghiêng hẳn về backend:

| Phía | Ngày công | Tỷ lệ | Số người | Tải mỗi người |
|------|-----------|-------|----------|---------------|
| Backend | ~62 MD | 52% | 3 | ~21 MD |
| Frontend | ~41 MD | 34% | 2 | ~20 MD |
| Chung (tài liệu, test, deploy, báo cáo) | ~17 MD | 14% | 5 | ~3 MD |
| **Tổng** | **~120 MD** | | **5** | **~24 MD/người** |

Tải hai bên xấp xỉ bằng nhau — cách chia này hợp lý. Backend nhiều việc hơn vì phải cài toàn bộ 67 quy tắc nghiệp vụ `BR-xx`, còn frontend được hưởng lợi từ Ant Design (Table/Form có sẵn) và từ việc nhân bản mẫu code (`14` mục 15).

### 1.2. Ai đọc tài liệu nào

| Tài liệu | 3 người BE | 2 người FE |
|----------|:----------:|:----------:|
| `PRD.md` · `02` SRS · `07` Phân quyền · `10` Quy trình · `11` Kiểm thử | ✅ | ✅ |
| `API.md` — **hợp đồng chung, đổi phải báo nhau** | ✅ | ✅ |
| `ARCHITECTURE.md` | §3, §9, §10 | §4, §6 |
| `DATA-SCHEMA.md` | ✅ bắt buộc | 🔸 tham khảo khi cần hiểu dữ liệu |
| `03` Phân tích nghiệp vụ (67 quy tắc BR) | ✅ bắt buộc | 🔸 tham khảo |
| `08` Thiết kế giao diện | ❌ | ✅ bắt buộc |
| `14` Mẫu code | mục 15.1–15.3 | mục 15.4–15.6 |

> 📌 **Tài liệu chỉ nằm ở repo `FE_QuanLyKTX/docs/`.** Ba người BE đọc trực tiếp trên GitHub hoặc clone repo FE về máy. **Không sao chép sang repo BE** — hai bản sẽ lệch nhau.

### 1.3. Hai điểm giao nhau bắt buộc phối hợp

| Thời điểm | Việc | Cách làm |
|-----------|------|----------|
| **Đầu mỗi module** | Chốt endpoint trước khi code | Cập nhật `API.md` **trước**, báo trong nhóm chat. FE dựa vào đó viết dữ liệu giả, BE dựa vào đó viết service. Hai bên làm song song, không chờ nhau |
| **Khi nối API thật** | FE tắt mock, trỏ vào backend | Đặt `VITE_USE_MOCK=false`. Nếu response không khớp `API.md` → **sửa bên sai so với tài liệu**, không sửa tài liệu cho khớp code |

Nhờ có lớp dữ liệu giả (`14` mục 4.4), frontend **không bị chặn** dù backend chưa xong module nào.

### 1.4. Chia màn hình frontend cho 2 người

Toàn bộ **21 màn hình** đã có sẵn đường dẫn trong `src/routes/AppRoutes.jsx`. Màn hình chưa làm hiện hiển thị `PlaceholderPage` nên ứng dụng luôn chạy được — **không ai bị chặn bởi ai**.

Nguyên tắc chia: mỗi người sở hữu trọn một nhóm nghiệp vụ (một thư mục `features/<x>/`) để **hai người không bao giờ sửa cùng một file**, tránh xung đột khi gộp nhánh.

#### Người 4 — Frontend Lead

| # | Màn hình | Đường dẫn | API client | Độ khó | Ước tính |
|---|----------|-----------|------------|:------:|----------|
| — | *Khung nền, layout, routing, phân quyền* | — | — | 🔴 | ✅ xong |
| 1 | Dashboard | `/admin/dashboard` | `dashboardApi` | 🟡 | 1,0 ngày |
| 2 | Quản lý tòa nhà | `/admin/buildings` | `roomApi` | 🟢 | 0,5 ngày |
| 3 | Quản lý phòng | `/admin/rooms` | `roomApi` | 🟡 | 1,0 ngày |
| 4 | Tra cứu giường trống | `/admin/beds/available` | `roomApi` | 🟡 | 0,5 ngày |
| 5 | Đăng ký lưu trú | `/admin/residencies` | `residencyApi` | 🔴 | 1,5 ngày |
| 6 | Quản lý hợp đồng | `/admin/contracts` | `contractApi` | 🔴 | 1,5 ngày |
| 7 | Hợp đồng sắp hết hạn | `/admin/contracts/expiring` | `contractApi` | 🟢 | 0,5 ngày |
| 8 | Yêu cầu gia hạn / trả phòng | `/admin/requests` | `requestApi` | 🟡 | 1,0 ngày |
| 9 | Quản lý tài khoản | `/admin/users` | `authApi` | 🟡 | 1,0 ngày |
| | | | | | **~8,5 ngày** |

Kiêm thêm: review toàn bộ pull request của frontend, xử lý các lỗi giao diện chung.

#### Người 5 — Frontend Dev

| # | Màn hình | Đường dẫn | API client | Độ khó | Ước tính |
|---|----------|-----------|------------|:------:|----------|
| 1 | Quản lý sinh viên | `/admin/students` | `studentApi` | 🟡 | ✅ xong — **dùng làm mẫu** |
| 2 | Nhập chỉ số điện nước | `/admin/utility-readings` | `feeApi` | 🔴 | 1,5 ngày |
| 3 | Quản lý hóa đơn | `/admin/invoices` | `feeApi` | 🔴 | 2,0 ngày |
| 4 | Danh mục loại phí | `/admin/fee-types` | `feeApi` | 🟢 | 0,5 ngày |
| 5 | Lịch sử thanh toán | `/admin/payments` | `paymentApi` | 🟡 | 1,0 ngày |
| 6 | Cổng SV — Trang chủ | `/portal/home` | `portalApi` | 🟢 | ✅ xong |
| 7 | Cổng SV — Chỗ ở của tôi | `/portal/my-residence` | `portalApi` | 🟢 | 0,5 ngày |
| 8 | Cổng SV — Hợp đồng của tôi | `/portal/my-contracts` | `portalApi` | 🟢 | 0,5 ngày |
| 9 | Cổng SV — Hóa đơn của tôi | `/portal/my-invoices` | `portalApi` | 🟡 | 1,0 ngày |
| 10 | Cổng SV — Yêu cầu của tôi | `/portal/my-requests` | `portalApi` | 🟡 | 1,0 ngày |
| 11 | Cổng SV — Hồ sơ cá nhân | `/portal/profile` | `portalApi` | 🟢 | 0,5 ngày |
| | | | | | **~8,5 ngày** |

Kiêm thêm: rà soát hiển thị trên màn hình điện thoại cho toàn bộ 21 màn hình.

> 🟢 CRUD thuần — sao chép màn hình sinh viên là xong · 🟡 có thêm bộ lọc hoặc một quy tắc nghiệp vụ · 🔴 nhiều bước, nhiều trạng thái, cần đọc kỹ `03` trước khi code.

#### Ba màn hình khó — đọc trước khi bắt tay

| Màn hình | Vì sao khó | Đọc trước |
|----------|------------|-----------|
| Đăng ký lưu trú | Chọn giường phải lọc đúng giới tính; giường có thể bị người khác lấy mất giữa chừng → phải hiển thị lỗi `GENDER_MISMATCH` và `BED_NOT_AVAILABLE` một cách dễ hiểu | `03` BR-21→BR-27 |
| Nhập chỉ số điện nước | Chỉ số mới không được nhỏ hơn chỉ số cũ; nhập theo phòng nhưng chia đều cho từng người | `03` BR-41→BR-46 |
| Quản lý hóa đơn | Bốn trạng thái `unpaid → partial → paid → overdue`; nút hành động bật/tắt theo trạng thái; tiền còn nợ phải khớp từng đồng với backend | `03` BR-47→BR-55 |

#### Quy ước làm việc giữa hai người

| Việc | Quy ước |
|------|---------|
| Nhánh | `feature/<ten-man-hinh>` — ví dụ `feature/invoice-management`. Tên nhánh bằng tiếng Anh |
| Phạm vi sửa | Chỉ sửa file trong thư mục `features/` mình phụ trách |
| File dùng chung | `components/`, `hooks/`, `utils/`, `layouts/` — **báo nhau trước khi sửa** |
| Gộp nhánh | Tạo pull request, người còn lại review rồi mới gộp vào `main` |
| Dữ liệu giả | Cần thêm dữ liệu thì sửa `src/mocks/mockDb.js` — báo trong nhóm vì file này dùng chung |

---

## 2. Cấu trúc phân rã công việc (WBS)

```mermaid
flowchart TB
    P["DMS-KTX"] --> W1["1. Khởi động & Phân tích"]
    P --> W2["2. Nền tảng kỹ thuật"]
    P --> W3["3. Phân hệ Quản trị"]
    P --> W4["4. Phân hệ Tài chính"]
    P --> W5["5. Cổng sinh viên"]
    P --> W6["6. Báo cáo & Dashboard"]
    P --> W7["7. Kiểm thử & Hoàn thiện"]
    P --> W8["8. Triển khai & Bàn giao"]

    W1 --> W11["1.1 Khảo sát hiện trạng"]
    W1 --> W12["1.2 Đặc tả yêu cầu"]
    W1 --> W13["1.3 Phân tích nghiệp vụ"]
    W1 --> W14["1.4 Thiết kế CSDL & API"]

    W2 --> W21["2.1 Khởi tạo repo FE/BE"]
    W2 --> W22["2.2 CSDL + migration + seed"]
    W2 --> W23["2.3 Xác thực & phân quyền"]
    W2 --> W24["2.4 Layout, routing, component chung"]

    W3 --> W31["3.1 Quản lý sinh viên"]
    W3 --> W32["3.2 Tòa nhà / Phòng / Giường"]
    W3 --> W33["3.3 Hợp đồng lưu trú"]
    W3 --> W34["3.4 Yêu cầu gia hạn / trả phòng"]

    W4 --> W41["4.1 Danh mục phí & chỉ số ĐN"]
    W4 --> W42["4.2 Hóa đơn"]
    W4 --> W43["4.3 Thanh toán thủ công"]
    W4 --> W44["4.4 Tích hợp VNPay"]

    W5 --> W51["5.1 Đăng ký tài khoản SV"]
    W5 --> W52["5.2 Tra cứu giường trống (chỉ đọc)"]
    W5 --> W53["5.3 Hóa đơn & thanh toán online"]
    W5 --> W54["5.4 Gửi yêu cầu"]

    W6 --> W61["6.1 API tổng hợp"]
    W6 --> W62["6.2 Dashboard + biểu đồ"]
    W6 --> W63["6.3 Báo cáo + xuất Excel"]

    W7 --> W71["7.1 Unit & Integration test"]
    W7 --> W72["7.2 Kiểm thử hệ thống"]
    W7 --> W73["7.3 Sửa lỗi"]
    W7 --> W74["7.4 Rà soát bảo mật"]

    W8 --> W81["8.1 Deploy"]
    W8 --> W82["8.2 Viết báo cáo"]
    W8 --> W83["8.3 Chuẩn bị demo"]
```

---

## 3. Bảng công việc chi tiết

**Ký hiệu:** BE = Backend · FE = Frontend · BA = Phân tích · PM = Quản lý · `MD` = man-day (ngày công)

### Giai đoạn 1 – Khởi động & Phân tích (Tuần 1–2)

| ID | Công việc | Người | MD | Phụ thuộc | Kết quả bàn giao |
|----|-----------|-------|-----|-----------|------------------|
| T1.1 | Khảo sát hiện trạng, tham khảo hệ thống tương tự | BA, PM | 2 | – | Mục 1.3 của `01` |
| T1.2 | Viết tài liệu tổng quan, chốt phạm vi | PM, BA | 2 | T1.1 | `01-TONG-QUAN-DU-AN.md` |
| T1.3 | Đặc tả yêu cầu chức năng và phi chức năng | BA | 3 | T1.2 | `02-DAC-TA-YEU-CAU.md` |
| T1.4 | Vẽ use case, viết đặc tả use case chi tiết | BA | 2 | T1.3 | Mục 2, 5 của `02` |
| T1.5 | Phân tích nghiệp vụ, quy tắc BR, máy trạng thái | BA, BE Lead | 3 | T1.3 | `03-PHAN-TICH-NGHIEP-VU.md` |
| T1.6 | Thiết kế ERD và từ điển dữ liệu | BE Lead | 3 | T1.5 | `DATA-SCHEMA.md` |
| T1.7 | Chốt kiến trúc và tech stack | BE Lead, FE Lead | 1 | T1.2 | `ARCHITECTURE.md` |
| T1.8 | Thiết kế hợp đồng API | BE Lead, FE Lead | 3 | T1.6 | `API.md` |
| T1.9 | Ma trận phân quyền | BA, BE Lead | 1 | T1.3 | `07-PHAN-QUYEN-BAO-MAT.md` |
| T1.10 | Sitemap, wireframe các màn hình chính | FE Lead | 3 | T1.3 | `08-THIET-KE-GIAO-DIEN.md` |
| T1.11 | Lập kế hoạch, phân công, lộ trình | PM | 2 | Tất cả | `09`, `13` |

### Giai đoạn 2 – Nền tảng kỹ thuật (Tuần 3)

| ID | Công việc | Người | MD | Phụ thuộc | Kết quả bàn giao |
|----|-----------|-------|-----|-----------|------------------|
| T2.1 | Khởi tạo repo backend, cấu trúc thư mục, ESLint/Prettier | BE Lead | 1 | T1.7 | Repo BE chạy được `GET /health` |
| T2.2 | Cài Mongoose, viết `các file *.model.js` **13 bảng**, chạy migration | BE Lead | 1.5 | T1.6 | CSDL tạo được từ migration (không cần viết index thủ công) |
| T2.3 | Viết script seed dữ liệu mẫu | BE Dev | 1.5 | T2.2 | `npm run seed` chạy thành công |
| T2.4 | Middleware nền: error handler, response chuẩn, logger, requestId | BE Lead | 1 | T2.1 | Mọi lỗi trả đúng định dạng |
| T2.5 | API xác thực: login, register, refresh, logout, me, đặt lại mật khẩu (FR-09) | BE Lead | 2 | T2.2, T2.4 | 7 endpoint `/auth/*` + `/users/:id/reset-password` chạy được |
| T2.6 | Middleware RBAC + kiểm tra ownership | BE Lead | 1 | T2.5 | `authorize()` hoạt động đúng ma trận |
| T2.7 | Cấu hình FE: React Router, Axios, Ant Design + viết hook `useApi` và `AuthContext` | FE Lead | 1.5 | T1.7 | App chạy, gọi được API (`14` mục 4.1–4.2) |
| T2.8 | AdminLayout, PortalLayout, sidebar, header | FE Lead | 2 | T2.7 | 2 layout hoàn chỉnh |
| T2.9 | Màn hình đăng nhập/đăng ký, authStore, ProtectedRoute, RoleRoute | FE Lead | 2 | T2.5, T2.8 | Đăng nhập thật vào được hệ thống |
| T2.10 | Component dùng chung: StatusTag, MoneyText, ConfirmModal, EmptyState, PageHeader + hook `useApi` + `AuthContext` | FE Dev | 2.5 | T2.8 | Thư viện component nội bộ (`14` mục 4.1–4.3) |
| T2.11 | Dữ liệu giả trong `mocks/mockData.js` theo đặc tả `API.md` | FE Dev | 0.5 | T1.8 | FE làm được khi BE chưa xong |
| ~~T2.12~~ | ~~Thiết lập CI~~ — v1-lite: chạy `npm run lint` tay trước khi mở PR | – | 0 | – | – |

### Giai đoạn 3 – Phân hệ Quản trị (Tuần 4–6)

| ID | Công việc | Người | MD | Phụ thuộc | Kết quả bàn giao |
|----|-----------|-------|-----|-----------|------------------|
| T3.1 | API sinh viên: CRUD, tìm kiếm, lọc, export | BE Dev | 3 | T2.6 | 10 endpoint `/students/*` |
| T3.2 | Màn hình danh sách + form + chi tiết sinh viên | FE Dev | 3 | T2.10, T3.1 | SCR-11, 12, 13 |
| T3.3 | API tòa nhà / phòng / giường (gồm sinh giường, đổi trạng thái) | BE Dev | 3 | T2.6 | `/buildings`, `/rooms`, `/beds` |
| T3.4 | API sơ đồ tòa nhà + tra cứu giường trống | BE Dev | 1.5 | T3.3 | `/buildings/:id/map`, `/beds/available` |
| T3.5 | Màn hình tòa nhà, phòng, chi tiết phòng & giường | FE Dev | 3 | T3.3 | SCR-21, 23, 24 |
| T3.6 | Màn hình sơ đồ tòa nhà (trực quan) | FE Lead | 2 | T3.4 | SCR-22 |
| T3.7 | Màn hình tra cứu giường trống | FE Dev | 1 | T3.4 | SCR-25 |
| T3.8 | **Service hợp đồng: tạo, duyệt, từ chối (transaction)** | BE Lead | 3 | T3.3 | BR-20, BR-21, BR-25 hoạt động đúng |
| T3.9 | API kích hoạt, chấm dứt hợp đồng, danh sách sắp hết hạn | BE Lead | 2 | T3.8 | `/api/contracts/*` đầy đủ |
| T3.10 | Màn hình danh sách + chi tiết hợp đồng | FE Dev | 2.5 | T3.8 | SCR-31, 34 |
| T3.11 | Màn hình đăng ký lưu trú (Staff xếp SV vào giường) | FE Lead | 2 | T3.8 | SCR-32 |
| T3.12 | Màn hình tạo hợp đồng + BedPicker | FE Lead | 2 | T3.8 | SCR-33 |
| T3.13 | API yêu cầu gia hạn / trả phòng + duyệt | BE Lead | 2.5 | T3.9 | `/requests/*` |
| T3.14 | Màn hình danh sách & xử lý yêu cầu | FE Dev | 2 | T3.13 | SCR-41, 42 |
| T3.15 | **1 cron job** `dailyJob.js` gồm 4 tác vụ | BE Dev | 1 | T3.9 | Job chạy đúng lịch, idempotent (`14` mục 4.9) |
| T3.16 | API quản lý tài khoản (Admin) | BE Dev | 1.5 | T2.6 | `/users/*` |
| T3.17 | Màn hình quản lý tài khoản | FE Dev | 1.5 | T3.16 | SCR-81 |

### Giai đoạn 4 – Phân hệ Tài chính (Tuần 6–8)

| ID | Công việc | Người | MD | Phụ thuộc | Kết quả bàn giao |
|----|-----------|-------|-----|-----------|------------------|
| T4.1 | API danh mục phí | BE Dev | 1 | T2.6 | `/fee-types/*` |
| T4.2 | API chỉ số điện nước (gồm nhập hàng loạt) | BE Dev | 2 | T3.3 | `/utility-readings/*` |
| T4.3 | Màn hình danh mục phí + nhập chỉ số ĐN | FE Dev | 2 | T4.1, T4.2 | SCR-82, SCR-55 |
| T4.4 | **Service hóa đơn: tạo, tính tổng, đổi trạng thái** | BE Dev | 3 | T3.8, T4.1 | BR-40→48 |
| T4.5 | **Lập hóa đơn hàng loạt theo kỳ (chia đều điện nước)** | BE Dev | 3 | T4.2, T4.4 | UC-04, BR-51 |
| T4.6 | API hủy hóa đơn, xuất Excel | BE Dev | 1 | T4.4 | |
| T4.7 | Màn hình danh sách + chi tiết hóa đơn | FE Dev | 2.5 | T4.4 | SCR-51, 54 |
| T4.8 | Màn hình tạo hóa đơn thủ công | FE Dev | 2 | T4.4 | SCR-52 |
| T4.9 | Màn hình lập hóa đơn hàng loạt (3 bước) | FE Lead | 2.5 | T4.5 | SCR-53 |
| T4.10 | API ghi nhận thanh toán thủ công + tính lại hóa đơn | BE Dev | 2 | T4.4 | BR-43, BR-44 |
| T4.11 | Màn hình lịch sử thanh toán + modal ghi nhận | FE Dev | 2 | T4.10 | SCR-56 |
| T4.12 | **Tích hợp VNPay: tạo URL + xác thực chữ ký tại Return URL** (không dùng IPN/ngrok) | BE Lead | 2 | T4.10 | UC-05, BR-55→58, `14` mục 4.10 |
| ~~T4.13~~ | ~~Tích hợp ZaloPay~~ — v1-lite: chỉ VNPay | – | 0 | – | – |
| T4.14 | Xử lý idempotent + nút đối soát thủ công | BE Lead | 1.5 | T4.12 | BR-56 |

### Giai đoạn 5 – Cổng sinh viên (Tuần 8–9)

| ID | Công việc | Người | MD | Phụ thuộc | Kết quả bàn giao |
|----|-----------|-------|-----|-----------|------------------|
| T5.1 | API `/portal/*`: hồ sơ, cư trú, bạn cùng phòng, giường trống | BE Dev | 2 | T3.4 | Lọc theo JWT (BR-85) |
| T5.2 | API cổng SV: hồ sơ, chỗ ở, hợp đồng (chỉ đọc, lọc theo JWT) | BE Lead | 1.5 | T3.8 | FR-82, FR-85 |
| T5.3 | API hóa đơn & thanh toán online cho sinh viên | BE Dev | 1.5 | T4.12 | Có kiểm tra ownership |
| T5.4 | API gửi/hủy yêu cầu | BE Dev | 1 | T3.13 | BR-70→78 |
| T5.5 | PortalLayout + trang chủ sinh viên (đủ 6 trạng thái) | FE Dev | 2.5 | T5.1 | SCR-61 |
| T5.6 | Màn hình chỗ ở của tôi + hợp đồng | FE Dev | 2 | T5.1 | SCR-62, 65 |
| T5.7 | Màn hình tra cứu giường trống (chỉ đọc) + gửi yêu cầu gia hạn/trả phòng | FE Lead | 2.5 | T5.2 | SCR-63, 64 |
| T5.8 | Màn hình hóa đơn + chi tiết + thanh toán | FE Dev | 2.5 | T5.3 | SCR-66, 67 |
| T5.9 | Màn hình kết quả thanh toán (có polling) | FE Lead | 1.5 | T5.3 | SCR-68 |
| T5.10 | Màn hình yêu cầu + gửi yêu cầu mới | FE Dev | 2 | T5.4 | SCR-69, 70 |
| T5.11 | Responsive toàn bộ cổng sinh viên | FE Dev | 1.5 | T5.10 | NFR-09 |

### Giai đoạn 6 – Dashboard & Báo cáo (Tuần 9–10)

| ID | Công việc | Người | MD | Phụ thuộc | Kết quả bàn giao |
|----|-----------|-------|-----|-----------|------------------|
| T6.1 | API dashboard tổng hợp (tối ưu truy vấn) | BE Dev | 2.5 | T4.4 | `/dashboard/*`, đạt NFR-02 |
| T6.2 | API báo cáo + xuất Excel | BE Dev | 2 | T6.1 | `/reports/*` |
| T6.3 | Màn hình dashboard + thẻ chỉ số | FE Lead | 2.5 | T6.1 | SCR-10 |
| T6.4 | Biểu đồ lấp đầy + doanh thu (Recharts) | FE Lead | 2 | T6.1 | FR-70 |
| T6.5 | Trung tâm báo cáo + nút xuất file | FE Dev | 2 | T6.2 | SCR-57 |

### Giai đoạn 7 – Kiểm thử & Hoàn thiện (Tuần 10–11)

| ID | Công việc | Người | MD | Phụ thuộc | Kết quả bàn giao |
|----|-----------|-------|-----|-----------|------------------|
| T7.1 | ~10 unit test cho 3 hàm tính tiền | BE Dev | 1 | GĐ 4 | `14` mục 8.1 |
| ~~T7.2~~ | ~~Integration test~~ — v1-lite: test bằng Postman thủ công | – | 0 | – | – |
| T7.3 | Thực thi 65 test case trọng tâm | BA | 2 | GĐ 6 | `11` mục 4 + `14` mục 8.2 |
| T7.4 | Kiểm thử phân quyền theo ma trận | BA, BE Lead | 1.5 | T7.3 | Checklist mục 6 của `07` |
| T7.5 | Sửa lỗi đợt 1 | Cả nhóm | 4 | T7.3 | Hết lỗi Critical/High |
| T7.6 | Rà soát bảo mật (chạy `/security-review`) | BE Lead | 1 | T7.5 | Checklist `07` đạt đủ |
| T7.7 | Tối ưu hiệu năng (index, N+1 query) | BE Lead | 1.5 | T7.5 | Đạt NFR-01, NFR-02 |
| T7.8 | Rà soát giao diện, responsive, thông báo tiếng Việt | FE Lead | 2 | T7.5 | NFR-09, NFR-19 |
| T7.9 | Sửa lỗi đợt 2 | Cả nhóm | 3 | T7.5 | Hết lỗi Medium |

### Giai đoạn 8 – Triển khai & Bàn giao (Tuần 11–12)

| ID | Công việc | Người | MD | Phụ thuộc | Kết quả bàn giao |
|----|-----------|-------|-----|-----------|------------------|
| T8.1 | Deploy backend + CSDL production | BE Lead | 1.5 | T7.9 | API công khai chạy được |
| T8.2 | Deploy frontend | FE Lead | 1 | T8.1 | Web công khai chạy được |
| T8.3 | Nạp dữ liệu demo, tạo tài khoản demo | BE Dev | 1 | T8.1 | 4 tài khoản demo |
| T8.4 | Kiểm thử trên môi trường production | BA | 1 | T8.2 | Biên bản UAT |
| T8.5 | Viết báo cáo đồ án | Cả nhóm | 5 | T8.4 | File báo cáo hoàn chỉnh |
| T8.6 | Viết hướng dẫn sử dụng + hướng dẫn cài đặt | BA, PM | 2 | T8.2 | 2 tài liệu HDSD |
| T8.7 | Chuẩn bị slide + kịch bản demo | PM | 2 | T8.5 | Slide + kịch bản |
| T8.8 | Diễn tập bảo vệ | Cả nhóm | 1 | T8.7 | Biên bản diễn tập |

---

## 4. Tổng hợp khối lượng

| Giai đoạn | Bản đầu (MD) | **v1-lite (MD)** | Tỷ trọng |
|-----------|--------------|------------------|----------|
| 1. Khởi động & Phân tích | 25 | **25** | 16% |
| 2. Nền tảng kỹ thuật | 19 | **13** | 8% |
| 3. Phân hệ Quản trị | 37 | **31** | 20% |
| 4. Phân hệ Tài chính | 32 | **23** | 15% |
| 5. Cổng sinh viên | 21 | **18** | 12% |
| 6. Dashboard & Báo cáo | 11 | **9** | 6% |
| 7. Kiểm thử & Hoàn thiện | 20 | **14** | 9% |
| 8. Triển khai & Bàn giao | 14.5 | **12** | 8% |
| Dự phòng | 27 | **10** | 6% |
| **Tổng cộng** | **~206** | **~155 ngày công** | 100% |

**Diễn giải:** với nhóm 5 người làm bán thời gian (trung bình 3 ngày công/người/tuần), năng lực = 18 MD/tuần × 12 tuần = **216 ngày công**.

| | Bản đầu | v1-lite |
|---|---------|---------|
| Khối lượng / Năng lực | 206/216 = **95%** — kín, không có chỗ cho sai sót | 155/216 = **72%** — còn ~28% dư địa cho việc học, gỡ lỗi, thi cử |

Chi tiết 21 thay đổi giúp giảm 51 ngày công: [`14-PHIEN-BAN-DON-GIAN-HOA.md`](14-PHIEN-BAN-DON-GIAN-HOA.md) mục 2.

**Nếu nhóm ít hơn 5 người:** xem thang cắt giảm 7 bậc tại `14` mục 9. Tóm tắt:
- **4 người** (~144 MD năng lực): cắt bậc 1–2 (sơ đồ tòa nhà, biểu đồ dashboard) → về ~150 MD, vẫn hơi sát.
- **3 người** (~108 MD năng lực): cắt tới bậc 5 → về ~144 MD, vẫn thiếu — cần tăng thời gian đóng góp mỗi người hoặc xin gia hạn.

---

## 5. Ma trận RACI

`R` = Thực hiện · `A` = Chịu trách nhiệm cuối · `C` = Được hỏi ý kiến · `I` = Được thông báo

| Hạng mục | PM | BA | BE Lead | BE Dev | FE Lead | FE Dev |
|----------|----|----|---------|--------|---------|--------|
| Chốt phạm vi dự án | A | R | C | I | C | I |
| Đặc tả yêu cầu | A | R | C | I | C | I |
| Thiết kế CSDL | I | C | A/R | R | I | I |
| Hợp đồng API | I | C | A/R | R | C | I |
| Thiết kế giao diện | I | C | I | I | A/R | R |
| Cài đặt backend | I | I | A | R | I | I |
| Cài đặt frontend | I | I | I | I | A | R |
| Tích hợp thanh toán | I | C | A/R | C | I | C |
| Kiểm thử | I | A/R | C | R | C | R |
| Rà soát bảo mật | I | C | A/R | R | C | I |
| Triển khai | A | I | R | C | R | I |
| Viết báo cáo | A/R | R | C | C | C | C |
| Demo bảo vệ | A/R | R | R | C | R | C |

---

## 6. Quy tắc phối hợp

### 6.1. Nhịp làm việc

| Hoạt động | Tần suất | Thời lượng | Nội dung |
|-----------|----------|------------|----------|
| **Standup** | Thứ 2 & Thứ 5 | 15 phút | Mỗi người: hôm qua làm gì, hôm nay làm gì, đang vướng gì |
| **Sprint Planning** | Đầu mỗi sprint (2 tuần) | 60 phút | Chọn task, ước lượng, phân công |
| **Sprint Review** | Cuối mỗi sprint | 45 phút | Demo những gì đã làm được cho cả nhóm |
| **Retrospective** | Cuối mỗi sprint | 30 phút | Điều gì tốt, điều gì cần cải thiện |
| **Báo cáo GVHD** | 2 tuần/lần | 30 phút | Tiến độ, vướng mắc, xin ý kiến |

### 6.2. Kênh liên lạc

| Kênh | Dùng cho | Thời gian phản hồi kỳ vọng |
|------|----------|----------------------------|
| Nhóm chat (Zalo/Discord) | Trao đổi hằng ngày, hỏi nhanh | Trong ngày |
| GitHub Issues/Projects | Theo dõi task, báo lỗi | Trong ngày |
| GitHub PR | Review code | Trong 24 giờ |
| Họp trực tiếp/online | Quyết định quan trọng, gỡ vướng lớn | Theo lịch |

### 6.3. Quy tắc khi phát sinh thay đổi

```mermaid
flowchart LR
    A["Phát sinh yêu cầu<br/>hoặc thay đổi"] --> B{"Thuộc phạm vi<br/>MVP đã chốt?"}
    B -->|"Không"| C["Ghi vào Backlog v2<br/>KHÔNG làm ngay"]
    B -->|"Có"| D{"Ảnh hưởng<br/>API/CSDL?"}
    D -->|"Không"| E["Tự thực hiện,<br/>thông báo nhóm chat"]
    D -->|"Có"| F["Cập nhật tài liệu 04/06 TRƯỚC"]
    F --> G["Thông báo phía còn lại<br/>(FE hoặc BE)"]
    G --> H["Thực hiện + PR<br/>kèm cập nhật tài liệu"]
```

### 6.4. Xử lý khi bị chặn (blocked)

1. Thử tự gỡ trong tối đa **2 giờ**.
2. Chưa xong → đăng vào nhóm chat, nêu rõ: đang làm gì, lỗi gì, đã thử cách nào.
3. Sau 1 ngày vẫn chặn → báo PM để điều chỉnh phân công hoặc đổi task.
4. Ghi lại vướng mắc và cách giải quyết vào Wiki nhóm để người sau không mắc lại.

---

## 7. Theo dõi tiến độ

### 7.1. Bảng theo dõi sprint

| Sprint | Tuần | Mục tiêu | Cam kết (MD) | Hoàn thành | Ghi chú |
|--------|------|----------|--------------|------------|---------|
| Sprint 0 | 1–2 | Hoàn thiện tài liệu | 25 | | |
| Sprint 1 | 3–4 | Nền tảng + Quản lý sinh viên | 24 | | |
| Sprint 2 | 5–6 | Cơ sở vật chất + Hợp đồng | 29 | | |
| Sprint 3 | 7–8 | Tài chính + Thanh toán | 25 | | |
| Sprint 4 | 9–10 | Cổng SV + Dashboard | 26 | | |
| Sprint 5 | 11–12 | Kiểm thử + Triển khai + Báo cáo | 26 | | |

### 7.2. Chỉ số theo dõi

| Chỉ số | Cách đo | Ngưỡng cảnh báo |
|--------|---------|-----------------|
| Tỷ lệ hoàn thành sprint | Task xong / task cam kết | < 80% → xem lại ước lượng |
| Số lỗi mở | Đếm issue nhãn `bug` chưa đóng | > 15 → dừng phát triển tính năng, tập trung sửa lỗi |
| Thời gian PR chờ review | Từ lúc mở đến lúc merge | > 48 giờ → nhắc trong standup |
| Số yêu cầu vượt phạm vi | Đếm mục ghi vào Backlog v2 | > 10 → họp lại về phạm vi |

---

## 8. Lịch sử phiên bản

| Phiên bản | Ngày | Người thực hiện | Nội dung thay đổi |
|-----------|------|------------------|-------------------|
| v1.0 | 11/09/2026 | PM | Khởi tạo WBS, phân công, RACI, quy tắc phối hợp |
| **v2.2** | **12/09/2026** | FE Lead | Thêm mục **1.4**: chia 21 màn hình cho 2 người frontend (mỗi người ~8,5 ngày), đánh dấu 3 màn hình khó cần đọc nghiệp vụ trước, chốt quy ước nhánh và phạm vi sửa file |
| v2.1 | 12/09/2026 | PM | Chốt mô hình **2 repo** và phân công **3 backend / 2 frontend**; thêm mục 1.1 (lý do chia), 1.2 (ai đọc tài liệu nào), 1.3 (hai điểm giao nhau bắt buộc phối hợp) |
| v2.0 | 12/09/2026 | PM | **Rà soát theo bộ tài liệu v2.0:** nhóm 5 người; bỏ task chuyển phòng và task API nộp đơn; đổi tên task theo module mới (`residencies`, `fees`) |
| v1.1 | 12/09/2026 | PM | **Áp dụng v1-lite:** khối lượng 206 → 155 ngày công; bỏ T2.12 (CI), T4.13 (ZaloPay), T7.2 (integration test); rút gọn T2.2, T2.10, T2.11, T3.15, T4.12, T7.1, T7.3. Chức năng giữ nguyên — xem `14` |
