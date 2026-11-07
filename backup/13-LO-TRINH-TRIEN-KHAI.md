# 13 – LỘ TRÌNH TRIỂN KHAI A → Z

**Hệ thống:** DMS-KTX
**Phiên bản:** v2.0 (MongoDB + Mongoose)
**Thời lượng:** 12 tuần · **Khối lượng:** ~120 ngày công ([phiên bản đơn giản hóa Bậc B](14-PHIEN-BAN-DON-GIAN-HOA.md))

**Ngày bắt đầu giả định:** Thứ 2, 14/09/2026 · **Ngày bảo vệ dự kiến:** 05/12/2026

> ⚠️ **Đang áp dụng phiên bản đơn giản hóa Bậc B.** Các bước cài đặt, lệnh `npm install` và hướng dẫn VNPay dưới đây đã cập nhật theo bản này ([tài liệu 14](14-PHIEN-BAN-DON-GIAN-HOA.md)).
>
> 📌 **Bậc B đổi 2 thứ trong lộ trình này:** chỉ dùng nhánh **`main`** (không có `develop`); và **tuần 2 dành hẳn cho tự học** theo `14` mục 14.

> Tài liệu này trả lời câu hỏi **"làm vào lúc nào và làm thế nào"**. Câu hỏi **"ai làm gì"** nằm ở `09-KE-HOACH-PHAN-CONG.md`.
>
> 📌 **Cách dùng:** mỗi tuần mở đúng mục của tuần đó, làm theo thứ tự. Cuối tuần đối chiếu cột "Cột mốc nghiệm thu" — chưa đạt thì **không** sang tuần mới mà phải xử lý ngay.

---

## 1. Tổng quan lộ trình

```mermaid
gantt
    title Lộ trình 12 tuần DMS-KTX
    dateFormat YYYY-MM-DD
    axisFormat Tuần %W

    section Sprint 0 - Chuẩn bị
    Tài liệu & thiết kế           :done, s0a, 2026-09-14, 10d
    Dựng môi trường làm việc      :done, s0b, 2026-09-16, 5d

    section Sprint 1 - Nền tảng
    Khởi tạo BE + CSDL            :s1a, 2026-09-28, 5d
    Xác thực & phân quyền         :s1b, 2026-10-01, 4d
    Khởi tạo FE + layout          :s1c, 2026-09-28, 5d
    Module sinh viên              :s1d, 2026-10-05, 5d
    Deploy thử lần 1              :crit, s1e, 2026-10-08, 2d

    section Sprint 2 - Cốt lõi
    Cơ sở vật chất                :s2a, 2026-10-12, 5d
    Hợp đồng lưu trú              :crit, s2b, 2026-10-15, 7d
    Yêu cầu gia hạn/trả phòng     :s2c, 2026-10-22, 3d

    section Sprint 3 - Tài chính
    Phí & chỉ số điện nước        :s3a, 2026-10-26, 3d
    Hóa đơn                       :s3b, 2026-10-28, 5d
    Thanh toán thủ công           :s3c, 2026-11-02, 3d
    Tích hợp VNPay                :crit, s3d, 2026-11-04, 4d

    section Sprint 4 - Cổng SV & BC
    Cổng sinh viên                :s4a, 2026-11-09, 7d
    Dashboard & báo cáo           :s4b, 2026-11-16, 5d

    section Sprint 5 - Hoàn thiện
    Kiểm thử toàn hệ thống        :crit, s5a, 2026-11-23, 5d
    Sửa lỗi                       :s5b, 2026-11-26, 5d
    Deploy production             :crit, s5c, 2026-11-30, 3d
    Báo cáo & slide               :s5d, 2026-11-30, 5d
    Diễn tập bảo vệ               :s5e, 2026-12-04, 1d
```

| Sprint | Tuần | Ngày | Mục tiêu | Cột mốc nghiệm thu |
|--------|------|------|----------|---------------------|
| **Sprint 0** | 1–2 | 14/09 – 27/09 | Chốt tài liệu, dựng môi trường | Tài liệu 01–14 xong; cả nhóm chạy được "hello world" FE+BE+DB |
| **Sprint 1** | 3–4 | 28/09 – 11/10 | Nền tảng + Quản lý sinh viên | Đăng nhập thật được; CRUD sinh viên chạy end-to-end; **deploy thử thành công** |
| **Sprint 2** | 5–6 | 12/10 – 25/10 | Cơ sở vật chất + Hợp đồng | Xếp được sinh viên vào giường; duyệt đơn sinh hóa đơn tự động |
| **Sprint 3** | 7–8 | 26/10 – 08/11 | Tài chính + Thanh toán | Lập hóa đơn hàng loạt; **thanh toán VNPay sandbox thành công** |
| **Sprint 4** | 9–10 | 09/11 – 22/11 | Cổng sinh viên + Dashboard | Sinh viên tự đăng ký → thanh toán → trả phòng trọn vẹn |
| **Sprint 5** | 11–12 | 23/11 – 05/12 | Kiểm thử, deploy, báo cáo | 0 lỗi Critical/High; hệ thống công khai; báo cáo + slide xong |

---

## 2. Ba nguyên tắc xuyên suốt

### Nguyên tắc 1 – Chiều dọc trước, chiều ngang sau

**Sai:** làm hết toàn bộ API trước, rồi mới làm toàn bộ giao diện. Đến tuần 10 mới biết có nối được không.

**Đúng:** mỗi module làm trọn một "lát cắt dọc" — CSDL → API → giao diện → chạy được → mới sang module tiếp theo. Luôn có thứ demo được ở mọi thời điểm.

### Nguyên tắc 2 – Deploy sớm, deploy thường xuyên

Deploy thử ngay cuối Sprint 1 khi hệ thống mới chỉ có đăng nhập. Mọi vấn đề hạ tầng (CORS, biến môi trường, kết nối CSDL, HTTPS) sẽ lộ ra khi rủi ro còn thấp, thay vì dồn vào tuần cuối (rủi ro R8 ở `01`).

### Nguyên tắc 3 – Không tích lũy nợ

Cuối mỗi sprint, mọi lỗi mức Critical/High **phải** được xử lý trước khi sang sprint mới. Lỗi tồn đọng sẽ nhân lên và làm sập tiến độ cuối kỳ.

---

## 3. Sprint 0 (Tuần 1–2): Chuẩn bị

### 3.1. Ngày 1 – Họp khởi động (2 giờ)

| Nội dung | Kết quả cần có |
|----------|----------------|
| Đọc chung `01-TONG-QUAN-DU-AN.md` | Cả nhóm hiểu và đồng thuận phạm vi |
| Xác định vai trò từng người | Điền tên vào bảng ở `09` mục 1 |
| Thống nhất lịch họp và kênh liên lạc | Lịch cố định trong tuần |
| Chốt danh sách ngoài phạm vi | Cam kết không phát sinh thêm |
| Tạo tài khoản dùng chung | GitHub org, kênh chat, bảng task |

**Chốt lại 3 điều với cả nhóm:**
1. Phạm vi đã khóa — ý tưởng mới ghi vào Backlog v2.
2. Cấm push thẳng vào `main`/`develop`.
3. API đổi thì cập nhật `API.md` trước khi code.

### 3.2. Cài đặt môi trường (mọi thành viên đều phải làm)

#### Bước 1 – Cài công cụ

| Công cụ | Phiên bản | Bắt buộc? | Link |
|---------|-----------|-----------|------|
| Node.js | 20 LTS | ✅ | nodejs.org |
| Git | mới nhất | ✅ | git-scm.com |
| VS Code | mới nhất | ✅ | code.visualstudio.com |
| Postman | mới nhất | ✅ | postman.com/downloads |
| MongoDB Compass | mới nhất | ✅ | mongodb.com/products/compass — giao diện xem dữ liệu |
| MongoDB Community Server | 7.x | ⬜ Tùy chọn | Chỉ cần nếu chọn phương án B ở Bước 3 |

**Kiểm tra sau khi cài:**
```bash
node -v    # phải ra v20.x.x
npm -v     # phải ra 10.x.x
git --version
```

#### Bước 2 – Cấu hình Git (chỉ làm một lần)
```bash
git config --global user.name "Ten Cua Ban"
git config --global user.email "email@sinhvien.edu.vn"
git config --global core.autocrlf true      # Windows
git config --global init.defaultBranch main
```

#### Bước 3 – Chuẩn bị MongoDB

Có hai phương án. **Khuyến nghị phương án A** cho nhóm mới bắt đầu.

---

**🅰️ Phương án A — MongoDB Atlas (đám mây, miễn phí)** ⭐ *khuyên dùng*

Không cần cài gì lên máy. Dùng chung một cụm cho cả lúc lập trình lẫn lúc deploy, nên **không bao giờ gặp cảnh "chạy được ở máy em mà lên hosting thì lỗi"**.

1. Đăng ký tại **mongodb.com/cloud/atlas** (miễn phí, không cần thẻ).
2. **Create Deployment** → chọn **M0 Free** → Provider `AWS`, Region **Singapore (ap-southeast-1)** → Create.
3. **Database Access** → *Add New Database User*:
   - Username: `dms_user`
   - Password: bấm **Autogenerate** rồi **lưu lại** — xem cảnh báo ký tự đặc biệt bên dưới
   - Role: `Read and write to any database`
4. **Network Access** → *Add IP Address* → **Allow access from anywhere** (`0.0.0.0/0`).
   > Bắt buộc phải mở như vậy vì Render gói miễn phí dùng IP động, không biết trước để whitelist. Chấp nhận được ở phạm vi đồ án vì vẫn phải có username/password mới vào được.
5. **Database → Connect → Drivers → Node.js**, copy chuỗi kết nối:
   ```
   mongodb+srv://dms_user:<db_password>@cluster0.abc12.mongodb.net/?retryWrites=true&w=majority
   ```
6. **Sửa lại chuỗi trước khi dùng** — thay `<db_password>` bằng mật khẩu thật và **chèn tên database** vào trước dấu `?`:
   ```
   mongodb+srv://dms_user:MatKhauThat@cluster0.abc12.mongodb.net/dms_ktx?retryWrites=true&w=majority
                                                                  ^^^^^^^ bắt buộc
   ```

> ⚠️ **Hai lỗi khiến gần như ai cũng vấp ở bước này:**
>
> **1. Quên tên database.** Nếu chuỗi là `...mongodb.net/?retryWrites...` (không có `dms_ktx`), Mongoose sẽ ghi vào database tên `test`. Ứng dụng vẫn chạy, nhưng mở Atlas không thấy dữ liệu đâu.
>
> **2. Mật khẩu có ký tự đặc biệt.** Các ký tự `@ : / ? # [ ] %` sẽ làm hỏng chuỗi kết nối. Hoặc đặt mật khẩu chỉ gồm chữ và số, hoặc mã hóa lại:
> ```js
> // Mật khẩu p@ss:w0rd  →  p%40ss%3Aw0rd
> console.log(encodeURIComponent('p@ss:w0rd'));
> ```

**Điểm cộng của Atlas:** cụm M0 vốn đã chạy ở chế độ **replica set**, nên nếu sau này nhóm cần dùng MongoDB transaction thật thì dùng được ngay, không phải cấu hình gì thêm (`ARCHITECTURE.md` §3.5).

---

**🅱️ Phương án B — MongoDB cài trên máy**

Chọn nếu mạng yếu hoặc muốn làm việc offline.

```bash
# Sau khi cài MongoDB Community Server, kiểm tra:
mongosh --eval "db.version()"
```

Chuỗi kết nối:
```
mongodb://localhost:27017/dms_ktx
```

Hoặc dùng Docker, không cần cài đặt gì:
```bash
docker run --name dms-mongo -p 27017:27017 -d mongo:7
```

> ⚠️ **Hạn chế của phương án B:** `mongod` chạy mặc định là **standalone**, **không hỗ trợ transaction**. Đây chính là lý do v1 dùng `findOneAndUpdate` có điều kiện thay vì transaction (`ARCHITECTURE.md` §3.5). Nếu nhất định cần transaction, khởi động dạng replica set một node:
> ```bash
> mongod --replSet rs0 --dbpath C:\data\db
> mongosh --eval "rs.initiate()"
> ```

---

**Dù chọn phương án nào**, ghi chuỗi kết nối vào file `.env` ở gốc repo **BE_QuanLyKTX**:
```bash
MONGODB_URI=mongodb+srv://dms_user:MatKhau@cluster0.abc12.mongodb.net/dms_ktx?retryWrites=true&w=majority
```

Rồi mở **MongoDB Compass**, dán đúng chuỗi đó vào để xem dữ liệu bằng giao diện.

#### Bước 4 – Cài extension VS Code
Xem danh sách ở `10-QUY-TRINH-LAM-VIEC.md` mục 5.2.

### 3.3. Khởi tạo repository

Nhóm dùng **2 repo**. Mọi thành viên clone cả hai.

#### Repo Frontend — `FE_QuanLyKTX` (đã có sẵn)

```bash
git clone https://github.com/<tài-khoản>/FE_QuanLyKTX.git
cd FE_QuanLyKTX
npm install
cp .env.example .env     # sửa VITE_API_BASE_URL nếu cần
npm run dev              # http://localhost:5173
```

Repo này chứa luôn thư mục **`docs/`** — tài liệu dùng chung cho cả hai đội.

#### Repo Backend — `BE_QuanLyKTX` (tạo mới)

```bash
mkdir BE_QuanLyKTX && cd BE_QuanLyKTX
npm init -y

npm install express cors helmet dotenv bcrypt jsonwebtoken mongoose node-cron express-rate-limit
npm install -D nodemon eslint

git init
git branch -M main
```

Tạo cấu trúc thư mục theo `ARCHITECTURE.md` §3.1:
```bash
mkdir -p src/modules/{auth,students,rooms,residencies,contracts,fees,payments,requests,dashboard}
mkdir -p src/core/{config,middlewares,errors,utils,jobs} src/shared/constants
```

Thêm script vào `package.json`:
```json
{
  "scripts": {
    "dev":  "nodemon src/server.js",
    "start": "node src/server.js",
    "seed": "node src/seed.js",
    "job":  "node src/core/jobs/daily-job.js run-now",
    "lint": "eslint ."
  }
}
```

Tạo `.gitignore` (**bắt buộc có `.env`**):
```gitignore
node_modules
.env
.env.local
*.log
coverage/
```

Tạo `README.md` trỏ về tài liệu — xem mẫu ở `14-PHIEN-BAN-DON-GIAN-HOA.md` mục 13.1.

Đẩy lên GitHub:
```bash
git add . && git commit -m "chore: initialize backend project structure"
git remote add origin https://github.com/<tài-khoản>/BE_QuanLyKTX.git
git push -u origin main
```

#### Thiết lập bảo vệ nhánh — làm trên **cả hai** repo

**Settings → Branches → Add rule** cho `main`:
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ⬜ ~~Require status checks~~ — không dùng CI; thay bằng quy ước **tự chạy `npm run lint` trước khi mở PR**

#### Mời thành viên

**Settings → Collaborators** trên cả hai repo → mời đủ 5 người. Người làm FE vẫn cần quyền đọc repo BE (để xem service khi nối API), và ngược lại.

### 3.4. Bảng công việc Sprint 0

| Ngày | Việc | Người | Kết quả |
|------|------|-------|---------|
| T2 tuần 1 | Họp khởi động, phân vai | Cả nhóm | Biên bản họp |
| T3–T4 tuần 1 | Hoàn thiện tài liệu 01, 02 | PM, BA | 2 file .md |
| T5–T6 tuần 1 | Tài liệu 03 (nghiệp vụ) | BA, BE Lead | `03` |
| T7 tuần 1 | Mọi người cài môi trường + tạo cụm MongoDB Atlas | Cả nhóm | Ai cũng chạy được `node -v` và kết nối được Atlas bằng MongoDB Compass |
| **Cả tuần 2** | **Tự học theo `14` mục 14.1** (~10 giờ/người) song song với việc hoàn thiện tài liệu | Cả nhóm | Ai cũng đọc hiểu được mẫu code ở `14` mục 15 |
| T2–T3 tuần 2 | Tài liệu 04 (CSDL), 05 (kiến trúc) | BE Lead | ERD chốt |
| T4–T5 tuần 2 | Tài liệu 06 (API), 07 (phân quyền) | BE Lead, FE Lead | Hợp đồng API chốt |
| T4–T6 tuần 2 | Tài liệu 08 (giao diện) | FE Lead | Sitemap + wireframe |
| T6 tuần 2 | Tài liệu 09, 10, 11, 12, 13 | PM, BA | Kế hoạch chốt |
| T7 tuần 2 | Khởi tạo 2 repo, bảo vệ nhánh, tạo bảng task | Lead | Repo sẵn sàng |

### 3.5. Cột mốc nghiệm thu Sprint 0

| # | Tiêu chí | ☐ |
|---|----------|---|
| 1 | 14 tài liệu hoàn chỉnh, cả nhóm đã đọc (đặc biệt là `14` mục 2 và 4.6) | ☐ |
| 2 | Mọi thành viên chạy được Node, Git, MongoDB trên máy | ☐ |
| 3 | 2 repo đã tạo, có nhánh `main` + `develop`, đã bật bảo vệ nhánh | ☐ |
| 4 | Bảng task đã tạo, toàn bộ task Sprint 1 đã nhập | ☐ |
| 5 | ERD và hợp đồng API đã được cả nhóm rà soát và đồng thuận | ☐ |

---

## 4. Sprint 1 (Tuần 3–4): Nền tảng + Quản lý sinh viên

### 4.1. Tuần 3 – Dựng khung

#### Backend (T2–T4)

**Ngày 1 – Cấu trúc dự án**
```
src/
├── server.js
├── app.js
├── config/{env.js, database.js}
├── middlewares/{error.middleware.js, requestId.middleware.js}
├── routes/index.js
├── utils/{ApiError.js, ApiResponse.js, asyncHandler.js, logger.js}
```
**Nghiệm thu:** `GET /api/health` trả `{ "success": true, "data": { "status": "ok", "uptime": 12.3 } }`

**Ngày 2 – Mongoose schema + migration**
```bash
# Viết mongoose/các file *.model.js theo docs/04, mục 3 — 13 bảng
npm run seed --name init
mongosh / MongoDB Compass   # kiểm tra bảng đã tạo đúng
```
> ✅ **Không cần migration.** Mongoose tự tạo collection và index từ file `*.model.js` ngay lần chạy đầu. BR-20/BR-21 được đảm bảo bằng `findOneAndUpdate` có điều kiện ở tầng service (`14-PHIEN-BAN-DON-GIAN-HOA.md` mục 4.6), cộng với partial unique index khai báo ngay trong schema.

**Ngày 3 – Seed dữ liệu**
```bash
npm install -D @faker-js/faker
# Viết mongoose/seed.js theo docs/04, mục 4
npm run seed
```
**Nghiệm thu:** CSDL có 3 tòa, 60 phòng, 400+ giường, 120 sinh viên, 4 tài khoản.

**Ngày 4–5 – Xác thực**
Cài `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/change-password`, `/api/users/:id/reset-password` + middleware `authenticate`, `authorize`. **Không có** `/auth/refresh` — v1 dùng 1 JWT hạn 7 ngày.

**Nghiệm thu:** Postman đăng nhập được cả 4 vai trò; gọi API không token trả 401; Viewer gọi API ghi trả 403.

#### Frontend (T2–T5, song song)

**Ngày 1 – Cấu trúc + provider**
Tạo cây thư mục theo `ARCHITECTURE.md` mục 3.1; cấu hình `axiosClient`, `AuthProvider`, `ConfigProvider` (locale tiếng Việt). Viết luôn hook `useApi` (`14` mục 4.1) — dùng cho toàn bộ dự án sau này.

**Ngày 2 – Layout**
`AdminLayout` (sidebar + header + breadcrumb), `PortalLayout`.

**Ngày 3 – Xác thực phía FE**
`AuthContext` (`14` mục 4.2), `LoginPage`, `RoleRoute`, interceptor gắn token + xử lý 401 (`14` mục 4.11).

**Nghiệm thu:** đăng nhập bằng tài khoản thật vào được dashboard; đăng xuất xóa token; gõ URL trang quản trị khi chưa đăng nhập bị đẩy về `/login`.

**Ngày 4–5 – Component dùng chung**
`StatusTag`, `MoneyText`, `ConfirmModal`, `EmptyState`, `PageHeader`. Dùng thẳng `Table` và `Form` của Ant Design, **không** viết lớp bọc riêng.

### 4.2. Tuần 4 – Module sinh viên + Deploy thử

| Ngày | Backend | Frontend |
|------|---------|----------|
| T2 | API `GET /students` (phân trang, tìm kiếm, lọc) | Màn hình danh sách sinh viên nối API thật |
| T3 | API `POST/PATCH /students`, validate | Form thêm/sửa sinh viên |
| T4 | API `GET /students/:id`, `PATCH /:id/status` (BR-13, BR-14) | Màn hình chi tiết sinh viên |
| T5 | API export Excel | Nút xuất Excel + rà soát |
| T6–T7 | **Deploy thử** | **Deploy thử** |

#### Quy trình deploy thử (rất quan trọng — làm ngay tuần 4)

Ba dịch vụ, đều miễn phí: **MongoDB Atlas** (dữ liệu) · **Render** (backend) · **Vercel** (frontend).

```
Trình duyệt ──► Vercel (React) ──► Render (Express) ──► Atlas (MongoDB)
               repo FE_QuanLyKTX    repo BE_QuanLyKTX      database dms_ktx
```

**Bước 1 – Cơ sở dữ liệu**

Đã tạo ở Sprint 0 (mục 3.2, Bước 3). Nếu muốn tách riêng dữ liệu thật với dữ liệu nghịch, tạo thêm một database trên **cùng cụm** bằng cách đổi tên trong chuỗi kết nối:

| Môi trường | Chuỗi kết nối |
|---|---|
| Lập trình | `...mongodb.net/dms_ktx_dev?retryWrites=true&w=majority` |
| Production | `...mongodb.net/dms_ktx?retryWrites=true&w=majority` |

Cụm M0 miễn phí có 512 MB — thừa sức cho cả hai database của đồ án.

**Bước 2 – Deploy backend lên Render**

1. Đăng ký render.com, kết nối GitHub.
2. **New → Web Service** → chọn repo **`BE_QuanLyKTX`**.
3. Cấu hình:

| Trường | Giá trị |
|---|---|
| Branch | `main` |
| Root Directory | *(để trống — repo BE đứng riêng)* |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

4. Tab **Environment** → thêm các biến:

```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://dms_user:MatKhau@cluster0.abc12.mongodb.net/dms_ktx?retryWrites=true&w=majority
JWT_SECRET=<chuỗi ngẫu nhiên dài, xem bên dưới>
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
CORS_ORIGIN=https://<điền-sau-bước-3>.vercel.app
ENABLE_CRON=true
TZ=Asia/Ho_Chi_Minh
```

Sinh `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

5. Deploy → theo dõi log → mở `https://<ten-app>.onrender.com/api/health`.
   Log phải có dòng `MongoDB connected`. Nếu không, xem bảng lỗi bên dưới.

**Bước 3 – Deploy frontend lên Vercel**

1. Đăng ký vercel.com, kết nối GitHub, **Import** repo **`FE_QuanLyKTX`**.
2. Cấu hình:

| Trường | Giá trị |
|---|---|
| Framework Preset | **Vite** |
| Root Directory | *(để trống — repo FE đứng riêng)* |
| Build Command | `npm run build` |
| Output Directory | `dist` |

3. **Environment Variables**:
```bash
VITE_API_BASE_URL=https://<ten-app>.onrender.com/api
VITE_USE_MOCK=false
```
4. Tạo file `vercel.json` ở gốc repo FE để React Router không bị 404 khi tải lại trang:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
5. Deploy.

**Bước 4 – Nối hai đầu**

1. Quay lại Render, sửa `CORS_ORIGIN` thành URL Vercel vừa nhận (**không có dấu `/` ở cuối**).
2. Render tự deploy lại.
3. Mở URL Vercel, thử đăng nhập.

**Bước 5 – Nạp dữ liệu mẫu lên Atlas**

```bash
cd BE_QuanLyKTX
# Trỏ tạm vào CSDL production rồi chạy seed
MONGODB_URI="mongodb+srv://dms_user:MatKhau@cluster0.abc12.mongodb.net/dms_ktx?retryWrites=true&w=majority" npm run seed
```

Trên Windows PowerShell:
```powershell
$env:MONGODB_URI="mongodb+srv://..."; npm run seed
```

Mở MongoDB Compass, kết nối vào cụm và kiểm tra database `dms_ktx` đã có đủ 12 collection.

#### Các lỗi thường gặp khi deploy lần đầu

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `MongooseServerSelectionError: Could not connect to any servers` | Chưa mở Network Access trên Atlas | Atlas → Network Access → thêm `0.0.0.0/0` |
| Kết nối được nhưng **Atlas không thấy dữ liệu** | Chuỗi kết nối thiếu tên database → đang ghi vào `test` | Thêm `/dms_ktx` vào trước dấu `?` |
| `MongoParseError: Invalid scheme` hoặc lỗi xác thực | Mật khẩu có ký tự đặc biệt chưa mã hóa | Đổi mật khẩu chỉ gồm chữ và số, hoặc dùng `encodeURIComponent` |
| `Authentication failed` | Sai user/password, hoặc user chưa có quyền | Atlas → Database Access → kiểm tra lại role `Read and write to any database` |
| `CORS policy: No 'Access-Control-Allow-Origin'` | `CORS_ORIGIN` sai hoặc thừa dấu `/` cuối | Điền đúng URL Vercel, bỏ dấu `/` |
| Build Render fail: `package.json not found` | Chọn nhầm repo, hoặc `package.json` không nằm ở gốc repo BE | Kiểm tra lại repo đã chọn trên Render |
| 404 khi tải lại trang React | Thiếu SPA rewrite | Tạo `vercel.json` ở gốc repo FE như bước 3.4 |
| API rất chậm ở lần gọi đầu (~30 giây) | Render gói miễn phí ngủ sau 15 phút không dùng | Bình thường. Trước buổi demo, gọi thử API một lần để "đánh thức" |
| `JWT malformed` | Thiếu biến `JWT_SECRET` trên Render | Thêm biến, deploy lại |
| Cron chạy hai lần | Bật `ENABLE_CRON=true` trên nhiều instance | Chỉ bật trên một instance duy nhất |

### 4.3. Cột mốc nghiệm thu Sprint 1

| # | Tiêu chí | ☐ |
|---|----------|---|
| 1 | Đăng nhập được bằng cả 4 vai trò trên môi trường local | ☐ |
| 2 | CRUD sinh viên chạy end-to-end (FE gọi API thật) | ☐ |
| 3 | Tìm kiếm, lọc, phân trang hoạt động | ☐ |
| 4 | BR-13, BR-14 chặn đúng khi vô hiệu hóa sinh viên | ☐ |
| 5 | **Hệ thống đã deploy và truy cập được qua URL công khai** | ☐ |
| 6 | Phân quyền hoạt động: Viewer không ghi được, Student không vào khu quản trị | ☐ |

---

## 5. Sprint 2 → Sprint 4: Phát triển tính năng

### 5.1. Sprint 2 (Tuần 5–6) – Cơ sở vật chất + Hợp đồng

| Tuần | Ngày | Backend | Frontend |
|------|------|---------|----------|
| 5 | T2–T3 | API tòa nhà, phòng, giường (CRUD + sinh giường) | Màn hình tòa nhà, phòng |
| 5 | T4 | API sơ đồ tòa + tra cứu giường trống | Màn hình chi tiết phòng & quản lý giường |
| 5 | T5–T6 | **`ContractService` — `createApplication()` + `approve()`** (đọc `14` mục 4.6 trước) | Màn hình sơ đồ tòa nhà |
| 6 | T2–T3 | API hợp đồng: tạo, từ chối, chấm dứt | Màn hình danh sách + chi tiết hợp đồng |
| 6 | T4 | API kích hoạt hợp đồng, danh sách sắp hết hạn | Màn hình đăng ký lưu trú (Staff xếp giường) |
| 6 | T5 | API yêu cầu gia hạn/trả phòng + duyệt | Màn hình tạo hợp đồng + `BedPicker` |
| 6 | T6 | Cron jobs JOB-01 → JOB-05 | Màn hình danh sách & xử lý yêu cầu |
| 6 | T7 | **Kiểm thử chéo + sửa lỗi** | **Kiểm thử chéo + sửa lỗi** |

**⚠️ Cảnh báo cho tuần 5, T5–T6:** đây là phần nghiệp vụ quan trọng nhất hệ thống. Đọc **`14` mục 4.6** (có mã nguồn mẫu đầy đủ) trước khi code, rồi đối chiếu `03` mục 4.1. Bắt buộc:
- Bọc `phiên ghi nhiều bước()`
- Chiếm giường bằng `Bed.findOneAndUpdate({ _id: bedId, status: 'available' }, { status: 'occupied' }, { new: true })` rồi **kiểm tra kết quả có `null` không**
- Kiểm tra đủ BR-20, BR-21, BR-06 (giới tính so với `room.gender`)
- Sinh **2 hóa đơn** kỳ đầu (`deposit` + `monthly`) **trong cùng** transaction — BR-25
- Test ngay TC-72 bằng 2 trình duyệt

**Cột mốc nghiệm thu Sprint 2:**

| # | Tiêu chí | ☐ |
|---|----------|---|
| 1 | Tạo được tòa → phòng → giường đầy đủ | ☐ |
| 2 | Xếp sinh viên vào giường thành công, hóa đơn kỳ đầu tự sinh | ☐ |
| 3 | TC-61, TC-62, TC-63 (xếp trùng giường, trùng SV, sai giới tính) đều chặn đúng | ☐ |
| 4 | **TC-72 (race condition 2 người cùng chọn 1 giường) đạt** | ☐ |
| 5 | Luồng duyệt/từ chối đơn hoạt động | ☐ |
| 6 | Trả phòng giải phóng giường đúng | ☐ |
| 7 | Cron job chạy đúng khi test thủ công | ☐ |

### 5.2. Sprint 3 (Tuần 7–8) – Tài chính + Thanh toán

| Tuần | Ngày | Backend | Frontend |
|------|------|---------|----------|
| 7 | T2 | API danh mục phí | Màn hình danh mục phí |
| 7 | T3 | API chỉ số điện nước | Màn hình nhập chỉ số |
| 7 | T4–T5 | `InvoiceService`: tạo, tính tổng, đổi trạng thái | Màn hình danh sách + chi tiết hóa đơn |
| 7 | T6 | **Lập hóa đơn hàng loạt + chia đều điện nước (BR-51)** | Màn hình tạo hóa đơn thủ công |
| 8 | T2 | API ghi nhận thanh toán thủ công | Màn hình lập hóa đơn hàng loạt (3 bước) |
| 8 | T3–T4 | **Tích hợp VNPay** (tạo URL + xác thực chữ ký Return URL) | Màn hình lịch sử thanh toán + modal ghi nhận |
| 8 | T5–T6 | Xử lý idempotent + nút đối soát thủ công | Màn hình kết quả thanh toán + rà soát giao diện tài chính |
| 8 | T7 | Kiểm thử chéo | Kiểm thử chéo |

#### Hướng dẫn tích hợp VNPay Sandbox (tuần 8, T3–T5)

**Bước 1 – Đăng ký tài khoản sandbox**
1. Truy cập https://sandbox.vnpayment.vn/devreg/
2. Điền form đăng ký (dùng email nhóm).
3. Nhận email chứa `vnp_TmnCode` và `vnp_HashSecret`.
4. Lưu vào `.env` — **tuyệt đối không commit**.

**Bước 2 – Luồng tạo URL thanh toán**
```js
// gateways/vnpay.gateway.js
export const createPaymentUrl = ({ transactionRef, amount, orderInfo, ipAddr }) => {
  const createDate = dayjs().format('YYYYMMDDHHmmss');
  const params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: env.VNP_TMN_CODE,
    vnp_Amount: amount * 100,          // VNPay dùng đơn vị nhỏ nhất: nhân 100
    vnp_CurrCode: 'VND',
    vnp_TxnRef: transactionRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: env.VNP_RETURN_URL,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };
  const sorted = sortObject(params);                              // Sắp xếp key theo alphabet
  const signData = new URLSearchParams(sorted).toString();
  const hmac = crypto.createHmac('sha512', env.VNP_HASH_SECRET);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  return `${env.VNP_URL}?${signData}&vnp_SecureHash=${signed}`;
};
```

**Bước 3 – Xác thực chữ ký kết quả trả về**
```js
// Dùng chung cho Return URL (v1-lite) và cho IPN nếu sau này bổ sung
export const verifySignature = (query) => {
  const received = query.vnp_SecureHash;
  const params = { ...query };
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;
  const signData = new URLSearchParams(sortObject(params)).toString();
  const expected = crypto.createHmac('sha512', env.VNP_HASH_SECRET)
    .update(Buffer.from(signData, 'utf-8')).digest('hex');
  return received === expected;   // BR-61
};
```

**Bước 4 – Thẻ test sandbox**

| Thông tin | Giá trị |
|-----------|---------|
| Ngân hàng | NCB |
| Số thẻ | `9704198526191432198` |
| Tên chủ thẻ | `NGUYEN VAN A` |
| Ngày phát hành | `07/15` |
| Mật khẩu OTP | `123456` |

**Bước 5 – Test ngay trên localhost, KHÔNG cần ngrok**

Ở v1-lite, kết quả thanh toán nhận qua **Return URL** — trình duyệt của sinh viên chuyển về `localhost:5173`, rồi frontend gửi tham số lên backend để xác thực chữ ký. VNPay **không** cần gọi trực tiếp vào máy bạn.

```bash
# .env — trỏ thẳng về localhost, chạy được ngay
VNP_RETURN_URL=http://localhost:5173/portal/payment-result
```

Ba test bảo mật quan trọng nhất kiểm tra bằng **Postman**, không cần thanh toán thật:
```
POST http://localhost:5000/api/payments/vnpay/verify
Body: { "vnp_TxnRef": "PAY...", "vnp_Amount": "24600000",
        "vnp_ResponseCode": "00", "vnp_SecureHash": "chuoi_bia_dat" }
→ phải trả 400 INVALID_SIGNATURE   (TC-103)
```

**Bước 6 – Các trường hợp bắt buộc test**

| Trường hợp | Kết quả mong đợi | TC | Test bằng |
|------------|------------------|-----|-----------|
| Thanh toán thành công | Hóa đơn → PAID | TC-101 | Trình duyệt + thẻ test |
| Người dùng hủy | Payment FAILED, hóa đơn không đổi | TC-102 | Trình duyệt |
| Chữ ký sai | `400 INVALID_SIGNATURE`, không cập nhật gì | TC-103 | **Postman** |
| Gọi `verify` lần 2 | `alreadyConfirmed: true`, chỉ 1 bản ghi payment | TC-104 | **Postman** |
| Số tiền không khớp | `422 AMOUNT_MISMATCH`, NEEDS_RECONCILIATION | TC-105 | **Postman** |
| SV đóng trình duyệt giữa chừng | Nhân viên bấm "Đối soát", giao dịch về đúng trạng thái | TC-107 | Trình duyệt |

**Cột mốc nghiệm thu Sprint 3:**

| # | Tiêu chí | ☐ |
|---|----------|---|
| 1 | Nhập chỉ số điện nước, tính đúng tiêu thụ và thành tiền | ☐ |
| 2 | Lập hóa đơn hàng loạt tạo đúng số lượng, đúng số tiền | ☐ |
| 3 | **TC-86, TC-87 (chia đều điện nước, có dư) đạt** | ☐ |
| 4 | Thanh toán một phần cập nhật đúng trạng thái | ☐ |
| 5 | **Thanh toán VNPay sandbox thành công end-to-end (trên localhost, không cần ngrok)** | ☐ |
| 6 | **TC-103, TC-104, TC-105 (bảo mật thanh toán) đều đạt qua Postman** | ☐ |

### 5.3. Sprint 4 (Tuần 9–10) – Cổng sinh viên + Dashboard

| Tuần | Ngày | Backend | Frontend |
|------|------|---------|----------|
| 9 | T2 | API `/portal/*`: hồ sơ, cư trú, bạn cùng phòng | PortalLayout + trang chủ sinh viên |
| 9 | T3 | API cổng SV (chỉ đọc, lọc theo JWT) | Màn hình chỗ ở của tôi + hợp đồng |
| 9 | T4 | API hóa đơn + thanh toán cho SV (có ownership check) | Màn hình tra cứu giường trống |
| 9 | T5–T6 | API gửi yêu cầu gia hạn/trả phòng cho SV | Màn hình gửi yêu cầu |
| 10 | T2 | API dashboard tổng hợp (tối ưu truy vấn) | Màn hình hóa đơn + thanh toán |
| 10 | T3 | API báo cáo + xuất Excel | Màn hình kết quả thanh toán (có polling) |
| 10 | T4–T5 | Tối ưu hiệu năng, thêm index | Dashboard + biểu đồ |
| 10 | T6 | **Rà soát bảo mật `/portal/*`** | Trung tâm báo cáo + responsive |
| 10 | T7 | Kiểm thử chéo | Kiểm thử chéo |

**⚠️ Ngày T6 tuần 10 — bắt buộc rà soát bảo mật cổng sinh viên:**
```bash
# Trong repo backend, lệnh này phải KHÔNG có kết quả:
grep -rn "req.query.studentId\|req.body.studentId\|req.params.studentId" src/routes/portal* src/controllers/portal*
```
Test thủ công TC-121 → TC-124: đăng nhập SV C, thử truy cập dữ liệu của SV A bằng Postman → phải trả 403 ở mọi trường hợp.

**Cột mốc nghiệm thu Sprint 4:**

| # | Tiêu chí | ☐ |
|---|----------|---|
| 1 | Staff xếp giường → SV đăng nhập xem chỗ ở → thanh toán online → gửi yêu cầu trả phòng → Staff duyệt + quyết toán cọc | ☐ |
| 2 | **TC-121 → TC-124 (IDOR) đều trả 403** | ☐ |
| 3 | Cổng sinh viên chạy tốt trên màn hình 375px | ☐ |
| 4 | Dashboard hiển thị đúng số liệu, phản hồi < 2 giây | ☐ |
| 5 | Xuất được báo cáo Excel | ☐ |

---

## 6. Sprint 5 (Tuần 11–12): Hoàn thiện và bàn giao

### 6.1. Tuần 11 – Kiểm thử và sửa lỗi

| Ngày | Việc | Người |
|------|------|-------|
| T2 | Chạy toàn bộ test case module xác thực, sinh viên, cơ sở vật chất (TC-01 → TC-53) | BA + 1 dev |
| T3 | Chạy test case hợp đồng, tài chính (TC-60 → TC-96) | BA + 1 dev |
| T4 | Chạy test case thanh toán online, cổng SV (TC-100 → TC-137) | BA + BE Lead |
| T4 | Chạy checklist bảo mật (`07` mục 6) + `/security-review` | BE Lead |
| T5 | Chạy test phi chức năng (TC-160 → TC-168) | FE Lead |
| T5–T6 | **Sửa lỗi Critical/High** | Cả nhóm |
| T7 | Chạy lại các test case đã thất bại (regression) | BA |

**Cách theo dõi:** mỗi lỗi tạo một GitHub Issue nhãn `bug` + mức độ, gán người sửa, liên kết với PR sửa lỗi. Cuối mỗi ngày cập nhật bảng ở `11` mục 6.2.

### 6.2. Tuần 12 – Triển khai production và bàn giao

#### T2 – Deploy production chính thức

**Checklist trước khi deploy:**

| # | Hạng mục | ☐ |
|---|----------|---|
| 1 | Nhánh `develop` đã merge vào `main` qua PR | ☐ |
| 2 | Đã tạo tag phiên bản: `git tag -a v1.0.0 -m "Phiên bản bảo vệ đồ án"` | ☐ |
| 3 | Toàn bộ biến môi trường production đã cấu hình, không còn giá trị dev | ☐ |
| 4 | `JWT_ACCESS_SECRET` production **khác** với local | ☐ |
| 5 | `NODE_ENV=production` | ☐ |
| 6 | `CORS_ORIGIN` trỏ đúng domain frontend production | ☐ |
| 7 | **Mật khẩu các tài khoản seed đã đổi** (không còn `Admin@123`) | ☐ |
| 8 | `ENABLE_CRON=true` trên đúng một instance | ☐ |

**Quy trình deploy:**
```bash
# 1. Gộp và gắn nhãn phiên bản
git checkout main && git pull
git tag -a v1.0.0 -m "Phien ban bao ve do an" && git push --tags

# 2. Render và Vercel TỰ deploy khi có commit mới trên main — chỉ cần theo dõi log

# 3. Nạp dữ liệu demo lên CSDL production
cd BE_QuanLyKTX
MONGODB_URI="<chuoi-atlas-production>" npm run seed

# 4. Sao lưu ngay sau khi nạp xong, phòng khi demo làm hỏng dữ liệu
mongodump --uri="<chuoi-atlas-production>" --out=backup_truoc_bao_ve
```

> 💡 **Mẹo trước buổi bảo vệ:** sao lưu một bản dữ liệu "đẹp" như trên. Nếu lúc diễn tập làm rối dữ liệu, khôi phục trong 30 giây bằng
> `mongorestore --uri="..." --drop backup_truoc_bao_ve/dms_ktx`.

**Smoke test sau deploy (15 phút):**

| # | Kiểm tra | ☐ |
|---|----------|---|
| 1 | `GET /api/health` trả 200 | ☐ |
| 2 | Đăng nhập được cả 4 vai trò | ☐ |
| 3 | Dashboard hiển thị số liệu | ☐ |
| 4 | Danh sách sinh viên tải được | ☐ |
| 5 | Tạo hợp đồng thành công | ☐ |
| 6 | Lập hóa đơn thành công | ☐ |
| 7 | Thanh toán VNPay sandbox chạy được | ☐ |
| 8 | Cổng sinh viên truy cập được, hiển thị đúng dữ liệu | ☐ |
| 9 | Trang web chạy trên HTTPS | ☐ |
| 10 | Mở bằng điện thoại thật, giao diện không vỡ | ☐ |

#### T3 – Chạy UAT trên production
Thực hiện 3 kịch bản UAT-01, UAT-02, UAT-03 ở `11` mục 5. Lập biên bản nghiệm thu có chữ ký cả nhóm.

#### T2–T5 – Viết báo cáo (song song)

| Ngày | Nội dung | Người |
|------|----------|-------|
| T2 | Chương 1 (tổng quan, cơ sở lý thuyết) | BA |
| T2 | Chương 2 (phân tích yêu cầu) | BA |
| T3 | Chương 3 (thiết kế) | BE Lead + FE Lead |
| T3 | **Chụp toàn bộ ảnh màn hình hệ thống** | FE Dev |
| T4 | Chương 4 (cài đặt, gồm mục 4.4 kỹ thuật nổi bật) | Cả nhóm |
| T4 | Chương 5 (kiểm thử, điền kết quả thật) | BA |
| T5 | Mở đầu, kết luận, phụ lục, ghép file, định dạng | PM |
| T5 | Hướng dẫn cài đặt + hướng dẫn sử dụng | BA |

> **Lưu ý về ảnh chụp màn hình:** chụp **sau khi** deploy production và nạp dữ liệu demo, để ảnh trông giống hệ thống thật đang chạy.

#### T5 – Chuẩn bị demo

| Việc | Chi tiết |
|------|----------|
| Làm slide | Theo cấu trúc ở `12` mục 7 |
| **Quay video demo dự phòng** | Quay full kịch bản UAT-01, 5–7 phút, có tiếng thuyết minh |
| Chuẩn bị dữ liệu demo sạch | Reset dữ liệu về trạng thái đẹp trước buổi bảo vệ |
| Chuẩn bị tài khoản demo | In ra giấy, đưa GVHD dùng thử |
| Kiểm tra thiết bị | Laptop, cáp HDMI, mạng dự phòng (phát 4G từ điện thoại) |

#### T6 – Diễn tập bảo vệ

| Việc | Thời lượng |
|------|-----------|
| Chạy thử toàn bộ bài thuyết trình có bấm giờ | 20 phút |
| Chạy thử demo (ít nhất 2 lần cho thuộc thao tác) | 15 phút |
| Tập trả lời câu hỏi phản biện (`12` mục 8) | 20 phút |
| Kiểm tra lần cuối hệ thống production | 10 phút |

#### T7 – Nộp bài

| # | Hạng mục | ☐ |
|---|----------|---|
| 1 | Báo cáo (bản in + file PDF) | ☐ |
| 2 | Mã nguồn (2 repo hoặc file nén) | ☐ |
| 3 | File dump CSDL kèm dữ liệu demo | ☐ |
| 4 | Hướng dẫn cài đặt + hướng dẫn sử dụng | ☐ |
| 5 | Slide thuyết trình | ☐ |
| 6 | Video demo dự phòng | ☐ |
| 7 | URL hệ thống + tài khoản demo | ☐ |

---

## 7. Runbook: các lệnh thường dùng

### 7.1. Khởi động môi trường local (mỗi ngày)

```bash
# Terminal 1 – Backend (trong repo BE_QuanLyKTX)
cd BE_QuanLyKTX
git pull origin main
npm install          # chỉ khi package.json đổi
npm run dev          # http://localhost:5000  — log phải có "MongoDB connected"

# Terminal 2 – Frontend (trong repo FE_QuanLyKTX)
cd FE_QuanLyKTX
git pull origin main
npm install
npm run dev          # http://localhost:5173
```

> Dùng MongoDB Atlas thì **không phải khởi động gì thêm** — cụm luôn chạy sẵn.
> Dùng MongoDB cài trên máy thì bật service trước (`net start MongoDB` trên Windows, hoặc `docker start dms-mongo`).

### 7.2. Bắt đầu một task mới

```bash
git checkout develop
git pull origin develop
git checkout -b feature/contract-approval
# ... code ...
git add .
git commit -m "feat(contract): add activation endpoint for contracts"
git push -u origin feature/contract-approval
# Mở PR trên GitHub, gán reviewer
```

### 7.3. Các lệnh hay dùng với MongoDB / Mongoose

**Không có lệnh migration.** Mongoose tự tạo collection và index từ file `*.model.js` ngay lần chạy đầu tiên — đây là điểm dễ hơn hẳn so với SQL.

```bash
npm run dev            # chạy backend, tự kết nối MongoDB theo MONGODB_URI
npm run seed           # nạp dữ liệu mẫu
npm run job            # chạy tay cron job để test, không phải chờ nửa đêm
```

**Xem dữ liệu:** mở **MongoDB Compass**, dán chuỗi `MONGODB_URI` → duyệt collection bằng giao diện. Đây là cách dễ nhất.

**Nếu thích dùng dòng lệnh (`mongosh`):**
```bash
mongosh "<MONGODB_URI>"

show collections                              # liệt kê collection
db.students.countDocuments()                  # đếm bản ghi
db.students.findOne()                         # xem 1 document mẫu
db.beds.find({ status: 'available' }).count() # đếm giường trống
db.getCollectionNames().forEach(c => print(c, db[c].countDocuments()))   # thống kê nhanh

db.residencies.getIndexes()                   # kiểm tra index đã tạo đúng chưa
db.dropDatabase()                             // ⚠️ XÓA SẠCH, chỉ dùng trên CSDL dev
```

**Kiểm tra partial unique index đã có hiệu lực** (rất nên làm sau khi viết model):
```js
db.residencies.getIndexes()
// Phải thấy: { bedId: 1 }, unique: true,
//            partialFilterExpression: { status: 'active' }
```

### 7.4. Sao lưu và khôi phục CSDL

Cài **MongoDB Database Tools** (mongodb.com/try/download/database-tools) để có `mongodump` / `mongorestore`.

```bash
# Sao lưu toàn bộ database (cả local lẫn Atlas đều dùng chung cú pháp)
mongodump --uri="<MONGODB_URI>" --out=backup_20261201

# Khôi phục
mongorestore --uri="<MONGODB_URI>" --drop backup_20261201/dms_ktx

# Sao lưu một collection
mongodump --uri="<MONGODB_URI>" --collection=students --out=backup_students

# Xuất JSON để đọc bằng mắt hoặc đưa vào phụ lục báo cáo
mongoexport --uri="<MONGODB_URI>" --collection=students --out=students.json --jsonArray
```

> **Quy tắc:** sao lưu CSDL production **trước mỗi lần** đổi cấu trúc dữ liệu lớn hoặc chạy script sửa dữ liệu hàng loạt.
>
> Atlas gói M0 miễn phí **không có snapshot tự động** — phải tự chạy `mongodump`. Đặt lịch nhắc mỗi tuần một lần, và bắt buộc chạy trước ngày bảo vệ.

### 7.5. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `EADDRINUSE: port 5000 already in use` | Tiến trình cũ chưa tắt | Windows: `netstat -ano \| findstr :5000` rồi `taskkill /PID <pid> /F` |
| `MongooseServerSelectionError` | Atlas chưa mở Network Access, hoặc `mongod` local chưa chạy | Atlas → Network Access → `0.0.0.0/0`. Local → khởi động service MongoDB |
| `Authentication failed` | Sai user/password trong `MONGODB_URI` | Kiểm tra Database Access trên Atlas; đổi mật khẩu chỉ gồm chữ và số |
| `MongoParseError` | Mật khẩu có ký tự đặc biệt chưa mã hóa | Dùng `encodeURIComponent(matKhau)` |
| **Kết nối được nhưng Compass không thấy dữ liệu** | Chuỗi kết nối thiếu tên database → đang ghi vào `test` | Thêm `/dms_ktx` trước dấu `?` trong `MONGODB_URI` |
| `E11000 duplicate key error` | Vi phạm unique index (VD: trùng `studentCode`, hoặc 2 Residency `active` trên 1 giường) | **Đây là index đang làm đúng việc.** Bắt lỗi ở service và trả mã lỗi nghiệp vụ thân thiện |
| Index không được tạo | Mongoose tạo index bất đồng bộ, hoặc collection đã tồn tại từ trước | Kiểm tra bằng `db.<collection>.getIndexes()`. Nếu thiếu, xóa collection trên CSDL dev rồi chạy lại |
| `Transaction numbers are only allowed on a replica set` | Gọi `session.startTransaction()` trên `mongod` standalone | v1 **không dùng** transaction (`ARCHITECTURE.md` §3.5). Nếu buộc phải dùng, chuyển sang Atlas hoặc bật replica set |
| FE gọi API bị CORS | `CORS_ORIGIN` sai hoặc thừa dấu `/` cuối | Kiểm tra lại trên Render |
| Đăng nhập được nhưng mọi API trả 401 | Interceptor chưa gắn header `Authorization` | Mở DevTools → Network → xem request header |
| Lỗi module không tìm thấy sau khi pull | `node_modules` lệch | `rm -rf node_modules package-lock.json && npm install` |

## 8. Bảng theo dõi tiến độ tổng thể

> Cập nhật vào cuối mỗi tuần trong buổi standup.

| Tuần | Ngày | Sprint | Kế hoạch | Trạng thái | Vướng mắc |
|------|------|--------|----------|------------|-----------|
| 1 | 14–20/09 | S0 | Tài liệu 01–03, cài môi trường | ☐ | |
| 2 | 21–27/09 | S0 | Tài liệu 04–13, khởi tạo repo | ☐ | |
| 3 | 28/09–04/10 | S1 | Nền tảng BE+FE, xác thực | ☐ | |
| 4 | 05–11/10 | S1 | Module sinh viên, **deploy thử** | ☐ | |
| 5 | 12–18/10 | S2 | Cơ sở vật chất, `ContractService.approve()` | ☐ | |
| 6 | 19–25/10 | S2 | Hợp đồng, yêu cầu, cron jobs | ☐ | |
| 7 | 26/10–01/11 | S3 | Phí, chỉ số ĐN, hóa đơn | ☐ | |
| 8 | 02–08/11 | S3 | Thanh toán, **tích hợp VNPay** | ☐ | |
| 9 | 09–15/11 | S4 | Cổng sinh viên | ☐ | |
| 10 | 16–22/11 | S4 | Dashboard, báo cáo, rà soát bảo mật | ☐ | |
| 11 | 23–29/11 | S5 | Kiểm thử toàn bộ, sửa lỗi | ☐ | |
| 12 | 30/11–05/12 | S5 | **Deploy production**, báo cáo, diễn tập | ☐ | |

---

## 9. Kế hoạch dự phòng khi chậm tiến độ

Nếu đến cuối tuần 8 mà chưa đạt cột mốc Sprint 3, kích hoạt phương án cắt giảm theo thứ tự:

| Mức | Cắt gì | Tiết kiệm | Ảnh hưởng |
|-----|--------|-----------|-----------|
| 1 | Sơ đồ tòa nhà trực quan (FR-26) → dùng bảng phòng thường | 2 ngày | Nhẹ, chỉ kém đẹp |
| 2 | ZaloPay (chỉ giữ VNPay) | 2 ngày | Vẫn chứng minh được năng lực tích hợp thanh toán |
| 3 | Sơ đồ tòa nhà trực quan (thay bằng bảng thường) | 2 ngày | Giảm tính thẩm mỹ |
| 4 | Xuất CSV các báo cáo (FR-17) | 1 ngày | Nêu rõ trong phần hạn chế của báo cáo |
| 5 | Biểu đồ dashboard (giữ lại thẻ chỉ số) | 2 ngày | Dashboard đơn giản hơn |
| 6 | Các báo cáo ưu tiên `S` (công nợ, doanh thu) | 2 ngày | Chỉ còn báo cáo giường trống |

**Tuyệt đối không cắt:**
- Xác thực và phân quyền (làm hệ thống mất ý nghĩa)
- Hợp đồng lưu trú (là trọng tâm của đề tài)
- Hóa đơn cơ bản và thanh toán thủ công
- Cổng sinh viên cơ bản
- Kiểm thử và deploy (không có thì không bảo vệ được)

---

## 10. Cạm bẫy khi cài đặt — đọc trước khi code từng module

> Đây là danh sách rút ra từ đợt rà soát chéo tài liệu ngày 12/09/2026. Mỗi mục là một lỗi **đã từng suýt lọt vào thiết kế**. Trước khi bắt đầu một module, đọc lại các mục tương ứng.

### 10.1. Nhóm hợp đồng & xếp giường

| # | Cạm bẫy | Hậu quả nếu mắc | Cách phòng |
|---|---------|-----------------|-----------|
| 1 | Kiểm tra giường trống **rồi mới** ghi bằng hai câu lệnh riêng | Hai sinh viên cùng vào một giường khi thao tác đồng thời | Đưa điều kiện vào `where` của `updateMany` rồi kiểm tra `count === 0` (`14` mục 4.6). Test bằng TC-72 |
| 2 | Bỏ qua giá trị trả về của `updateMany` | Race condition lọt lưới, hai hợp đồng trên một giường | **Luôn** kiểm tra `updated.count` và ném `409 BED_NOT_AVAILABLE` khi bằng 0 |
| 3 | **Kiểm tra giới tính ở mức tòa nhà** | Tòa `mixed` cho nam nữ ở chung phòng | Kiểm tra `room.gender`, không phải `building.gender_policy` (BR-06, BR-06). Test TC-63b |
| 4 | Đếm giường sót trạng thái `maintenance` | Dashboard cộng không khớp; giường bảo trì bị tính là còn trống | `total = occupied + available + maintenance`. Lọc `status: 'available'` khi tra cứu, **không** dùng `status != 'occupied'` |
| 5 | Đổi trạng thái giường rải rác nhiều nơi | Trạng thái giường lệch với hợp đồng thực tế | Chỉ đổi qua `BedService.changeStatus()`; JOB-05 đối soát hằng ngày |
| 6 | Lấy giá bằng cách đọc `Room.pricePerBed` tại thời điểm lập hóa đơn | Tăng giá phòng làm thay đổi cả hóa đơn cũ của sinh viên | Chốt giá vào `Contract.monthlyPrice` ngay lúc ký (BR-27) |

### 10.2. Nhóm hóa đơn & thanh toán

| # | Cạm bẫy | Hậu quả nếu mắc | Cách phòng |
|---|---------|-----------------|-----------|
| 7 | **Gộp tiền cọc và tiền phòng tháng đầu vào một hóa đơn** | Hóa đơn đó chiếm khóa `(student, MONTHLY, kỳ)`; đợt lập hóa đơn cuối kỳ bỏ qua sinh viên ⇒ **thất thu toàn bộ tiền điện nước kỳ đầu** | Tách 2 hóa đơn: `deposit` (`period = null`) và `monthly` (BR-25). Test TC-69, TC-69b |
| 8 | Lập hóa đơn hàng loạt theo logic "đã có thì bỏ qua" | Sinh viên vào ở giữa kỳ không bao giờ bị thu điện nước | Logic đúng là "bổ sung dòng phí còn thiếu" (BR-48, FR-59) |
| 9 | Cộng dồn `paid_amount += amount` mỗi lần thanh toán | Sai số tích lũy; IPN trùng làm cộng đôi | Luôn tính lại `SUM(payment WHERE status='success')` (BR-43) |
| 10 | Dùng `Math.round()` khi chia đều điện nước | Tổng các phần **lớn hơn** tiền thực tế của phòng | Dùng `Math.floor()` + dồn dư cho MSSV nhỏ nhất (BR-51). Test TC-87 |
| 11 | Dùng kiểu `float`/`double` cho tiền | Sai số dấu phẩy động, lệch vài đồng khi đối soát | `DECIMAL(12,2)` ở CSDL; tính bằng số nguyên đồng ở JS |
| 12 | Ghi nhận thanh toán từ Return URL mà **không xác thực chữ ký** | Người dùng sửa URL là tự "thanh toán" được | Xác thực HMAC trước mọi thứ — đây là điều kiện bắt buộc để phương án Return URL an toàn (`14` mục 4.10) |
| 13 | Không kiểm tra chữ ký trước khi xử lý | Bất kỳ ai cũng gọi được `verify` với dữ liệu giả để xóa nợ | Verify HMAC trước mọi thứ (BR-61). Test TC-103 bằng Postman |
| 14 | Xử lý kết quả không idempotent | Người dùng tải lại trang kết quả ⇒ ghi nhận tiền 2 lần | Kiểm tra `payment.status === 'success'` trong transaction rồi thoát sớm (BR-56). Test TC-104 |
| 15 | Tính ra số tiền hoàn cọc nhưng không ghi nhận việc chi trả | Không đối soát được ai đã nhận lại cọc | Ghi bản ghi `payment` trạng thái `REFUNDED` gắn hóa đơn `settlement` (BR-77, BR-76) |
| 16 | Để frontend tính tiền rồi gửi số tiền lên | Người dùng sửa request để trả ít hơn | Mọi phép tính tiền do backend làm; FE chỉ hiển thị |

### 10.3. Nhóm bảo mật & phân quyền

| # | Cạm bẫy | Hậu quả nếu mắc | Cách phòng |
|---|---------|-----------------|-----------|
| 17 | Lấy `studentId` từ query/body trong `/portal/*` | Sinh viên xem được hóa đơn của người khác (IDOR) | Luôn lấy từ `req.user.studentId` (BR-85). Test TC-121→124 |
| 18 | Chỉ ẩn nút trên giao diện, không chặn ở API | Gọi thẳng API bằng Postman là qua mặt được | Mọi endpoint đều có `authorize()`. Test TC-07, TC-08 |
| 19 | Cho Staff đặt lại mật khẩu tài khoản Admin | Staff chiếm quyền Admin | Chặn theo `role` trong service. Test TC-17 |
| 20 | Không có cơ chế khôi phục mật khẩu | Người dùng quên mật khẩu bị khóa vĩnh viễn (vì không có email tự động) | FR-09: nhân viên đặt lại hộ, sinh mật khẩu tạm bằng `crypto.randomBytes` |
| 21 | Trả `404` khi truy cập tài nguyên của người khác | Lộ thông tin bản ghi đó có tồn tại hay không | Trả `403` thống nhất |

### 10.4. Nhóm phối hợp nhóm

| # | Cạm bẫy | Hậu quả nếu mắc | Cách phòng |
|---|---------|-----------------|-----------|
| 22 | FE và BE hiểu khác nhau về `pricePerBed` | Hóa đơn lệch 8 lần | Đã chốt: **giá mỗi giường/tháng** (`03` mục 5.1). Ai đổi phải sửa tài liệu trước |
| 23 | Vẽ giao diện cho chức năng không có trong `02` | Làm thừa, hoặc demo bị hỏi "cái này bấm vào không chạy?" | Mọi thành phần giao diện phải truy vết về một `FR-xx` |
| 24 | Sửa migration đã merge | Schema lệch giữa các máy, mất dữ liệu | Luôn tạo migration mới |
| 25 | Đổi API mà không báo phía còn lại | Nửa ngày công đổ sông | Cập nhật `API.md` trước, báo nhóm chat, rồi mới code |
| 26 | Để dồn deploy đến tuần cuối | Sự cố hạ tầng sát ngày bảo vệ | Deploy thử từ tuần 4 (mục 4.2) |

---

## 11. Lịch sử phiên bản

| Phiên bản | Ngày | Người thực hiện | Nội dung thay đổi |
|-----------|------|------------------|-------------------|
| v1.0 | 11/09/2026 | PM | Khởi tạo lộ trình 12 tuần, runbook triển khai, kế hoạch dự phòng |
| v1.1 | 12/09/2026 | PM | Bổ sung mục 10 — 26 cạm bẫy khi cài đặt, rút ra từ đợt rà soát chéo tài liệu |
| **v2.0** | **12/09/2026** | PM | **Rà soát theo bộ tài liệu v2.0:** cài MongoDB thay PostgreSQL; bỏ bước migration (Mongoose tự tạo index); bỏ task chuyển phòng; cột mốc nghiệm thu đổi theo luồng "Staff xếp giường" |
| v1.2 | 12/09/2026 | PM | **Áp dụng v1-lite:** cập nhật lệnh cài đặt, bỏ bước tạo index thủ công, **bỏ ngrok** (test VNPay ngay trên localhost), gộp cron job, khối lượng 206 → 155 ngày công. Xem `14` |
