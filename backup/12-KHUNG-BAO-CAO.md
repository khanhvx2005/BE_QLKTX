# 12 – KHUNG BÁO CÁO ĐỒ ÁN

**Hệ thống:** DMS-KTX
**Phiên bản:** v2.0
**Mục đích:** Hướng dẫn chuyển bộ tài liệu kỹ thuật (01–11, 13, 14) thành báo cáo đồ án hoàn chỉnh.

> 💡 **Nguyên tắc cốt lõi:** bộ tài liệu này đã chứa ~90% nội dung báo cáo. Việc còn lại là **sắp xếp lại theo mạch kể chuyện học thuật**, bổ sung phần mở đầu/kết luận và chèn ảnh chụp màn hình thật. **Không viết lại từ đầu.**

---

## 1. Mục lục báo cáo đề xuất

```
LỜI CẢM ƠN
LỜI CAM ĐOAN
MỤC LỤC
DANH MỤC HÌNH VẼ
DANH MỤC BẢNG BIỂU
DANH MỤC TỪ VIẾT TẮT

MỞ ĐẦU
  1. Lý do chọn đề tài
  2. Mục tiêu đề tài
  3. Đối tượng và phạm vi nghiên cứu
  4. Phương pháp thực hiện
  5. Bố cục báo cáo

CHƯƠNG 1: TỔNG QUAN VÀ CƠ SỞ LÝ THUYẾT          (~15 trang)
  1.1. Khảo sát hiện trạng quản lý ký túc xá
       1.1.1. Thực trạng tại các trường đại học Việt Nam
       1.1.2. Các vấn đề tồn tại
       1.1.3. Khảo sát các hệ thống tương tự
       1.1.4. Đề xuất giải pháp
  1.2. Cơ sở lý thuyết
       1.2.1. Kiến trúc Client–Server và mô hình SPA
       1.2.2. REST API và các nguyên tắc thiết kế
       1.2.3. Thư viện React và hệ sinh thái
       1.2.4. Node.js và Express Framework
       1.2.5. Cơ sở dữ liệu quan hệ và giao dịch (transaction)
       1.2.6. Xác thực JWT và phân quyền RBAC
       1.2.7. Tích hợp cổng thanh toán điện tử tại Việt Nam

CHƯƠNG 2: PHÂN TÍCH VÀ ĐẶC TẢ YÊU CẦU           (~25 trang)
  2.1. Tổng quan hệ thống
       2.1.1. Mục tiêu
       2.1.2. Phạm vi hệ thống
       2.1.3. Các bên liên quan
  2.2. Xác định tác nhân
  2.3. Yêu cầu chức năng
       2.3.1. Quản lý sinh viên
       2.3.2. Quản lý tòa nhà, phòng, giường
       2.3.3. Đăng ký lưu trú và hợp đồng
       2.3.4. Quản lý phí và thanh toán
       2.3.5. Dashboard và báo cáo
       2.3.6. Xác thực và phân quyền
       2.3.7. Cổng sinh viên
       2.3.8. Gia hạn và trả phòng
  2.4. Yêu cầu phi chức năng
  2.5. Mô hình hóa use case
       2.5.1. Sơ đồ use case tổng quát
       2.5.2. Đặc tả các use case chính
  2.6. Phân tích nghiệp vụ
       2.6.1. Quy tắc nghiệp vụ
       2.6.2. Máy trạng thái các đối tượng
       2.6.3. Sơ đồ luồng quy trình

CHƯƠNG 3: THIẾT KẾ HỆ THỐNG                     (~30 trang)
  3.1. Thiết kế kiến trúc
       3.1.1. Kiến trúc tổng thể
       3.1.2. Kiến trúc frontend
       3.1.3. Kiến trúc backend phân tầng
       3.1.4. Lựa chọn công nghệ và lý do
  3.2. Thiết kế cơ sở dữ liệu
       3.2.1. Sơ đồ thực thể quan hệ (ERD)
       3.2.2. Từ điển dữ liệu
       3.2.3. Ràng buộc toàn vẹn
       3.2.4. Thiết kế index
  3.3. Thiết kế API
       3.3.1. Quy ước chung
       3.3.2. Danh sách endpoint theo module
       3.3.3. Xử lý lỗi và mã lỗi nghiệp vụ
  3.4. Thiết kế phân quyền và bảo mật
       3.4.1. Mô hình RBAC và ma trận phân quyền
       3.4.2. Luồng xác thực JWT
       3.4.3. Các biện pháp bảo mật
  3.5. Thiết kế giao diện
       3.5.1. Nguyên tắc thiết kế
       3.5.2. Sitemap
       3.5.3. Thiết kế các màn hình chính

CHƯƠNG 4: CÀI ĐẶT VÀ TRIỂN KHAI                 (~25 trang)
  4.1. Môi trường phát triển
  4.2. Cấu trúc mã nguồn
  4.3. Cài đặt các chức năng chính (kèm ảnh chụp màn hình)
       4.3.1. Chức năng xác thực và phân quyền
       4.3.2. Chức năng quản lý sinh viên
       4.3.3. Chức năng quản lý cơ sở vật chất
       4.3.4. Chức năng quản lý hợp đồng
       4.3.5. Chức năng quản lý hóa đơn và thanh toán
       4.3.6. Tích hợp cổng thanh toán VNPay
       4.3.7. Cổng sinh viên
       4.3.8. Dashboard và báo cáo
  4.4. Xử lý các vấn đề kỹ thuật nổi bật
       4.4.1. Chống xếp trùng giường bằng transaction và cập nhật có điều kiện
       4.4.2. Đảm bảo idempotent khi xử lý kết quả thanh toán
       4.4.3. Thuật toán chia đều chi phí điện nước
       4.4.4. Tác vụ nền tự động hóa nghiệp vụ
  4.5. Triển khai hệ thống

CHƯƠNG 5: KIỂM THỬ VÀ ĐÁNH GIÁ                  (~15 trang)
  5.1. Chiến lược kiểm thử
  5.2. Kết quả kiểm thử chức năng
  5.3. Kết quả kiểm thử phi chức năng
  5.4. Đánh giá kết quả đạt được
  5.5. Hạn chế của hệ thống

KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN
  1. Kết quả đạt được
  2. Hạn chế
  3. Hướng phát triển

TÀI LIỆU THAM KHẢO
PHỤ LỤC
  A. Bảng tổng hợp yêu cầu chức năng
  B. Danh sách API đầy đủ
  C. Bảng test case chi tiết
  D. Hướng dẫn cài đặt và sử dụng
  E. Phân công công việc và đóng góp của thành viên
```

**Tổng dung lượng ước tính:** 110–130 trang (chưa kể phụ lục).

---

## 2. Bảng ánh xạ: tài liệu → chương báo cáo

| Chương/Mục báo cáo | Lấy nội dung từ | Cần bổ sung thêm |
|--------------------|------------------|-------------------|
| **Mở đầu – Lý do chọn đề tài** | `01` mục 1.1, 1.2 | Viết lại theo văn phong học thuật |
| **Mở đầu – Mục tiêu** | `01` mục 2 | – |
| **Mở đầu – Phạm vi** | `01` mục 3 | – |
| **Mở đầu – Phương pháp** | `09` mục 6.1 + `10` mục 1 | Nêu rõ quy trình Agile/Scrum rút gọn |
| **1.1 Khảo sát hiện trạng** | `01` mục 1.1, 1.2, 1.3 | Ảnh chụp các website tham khảo |
| **1.2 Cơ sở lý thuyết** | `ARCHITECTURE.md` mục 1, 2 | **Viết mới** — lý thuyết nền về React, Node, REST, JWT, RBAC (tra cứu tài liệu chính thức, có trích dẫn) |
| **2.1 Tổng quan hệ thống** | `01` mục 2, 3, 4 | – |
| **2.2 Tác nhân** | `02` mục 1 | – |
| **2.3 Yêu cầu chức năng** | `02` mục 3 | Chuyển bảng thành đoạn văn mô tả + giữ bảng tóm tắt |
| **2.4 Yêu cầu phi chức năng** | `02` mục 4 | – |
| **2.5 Use case** | `02` mục 2, 5 | Xuất sơ đồ Mermaid thành ảnh PNG |
| **2.6 Phân tích nghiệp vụ** | `03` toàn bộ | Xuất máy trạng thái và luồng quy trình thành ảnh |
| **3.1 Kiến trúc** | `ARCHITECTURE.md` mục 1, 2, 3 | Mục 3.1.4 "Lựa chọn công nghệ và lý do": lấy lập luận từ `14` mục 10 |
| **3.2 Cơ sở dữ liệu** | `DATA-SCHEMA.md` mục 1, 2, 3, 7 | Xuất ERD thành ảnh chất lượng cao |
| **3.3 API** | `API.md` mục 1, 15 + chọn lọc ví dụ | Không đưa toàn bộ 53 endpoint vào thân bài — để ở Phụ lục B |
| **3.4 Phân quyền & bảo mật** | `07` mục 1, 2, 3, 4, 5 | – |
| **3.5 Giao diện** | `08` mục 1, 2, 4, 6 | Thay wireframe ASCII bằng ảnh chụp màn hình thật |
| **4.1 Môi trường phát triển** | `ARCHITECTURE.md` mục 2 + `13` mục 3 | Ảnh chụp VS Code, cấu hình |
| **4.2 Cấu trúc mã nguồn** | `ARCHITECTURE.md` mục 3 | Ảnh chụp cây thư mục thật |
| **4.3 Cài đặt chức năng** | `08` mục 6 | **Viết mới** — mỗi chức năng: mô tả + ảnh chụp + đoạn code tiêu biểu |
| **4.4 Vấn đề kỹ thuật nổi bật** | `03` mục 3, `DATA-SCHEMA.md` mục 7, `14` mục 4.6 và 4.10 | **Phần ăn điểm nhất** — xem mục 4 bên dưới |
| **4.5 Triển khai** | `13` mục 6 | Ảnh chụp trang quản trị Vercel/Render |
| **5.1 Chiến lược kiểm thử** | `11` mục 1, 2, 3 | – |
| **5.2, 5.3 Kết quả kiểm thử** | `11` mục 4, 6 | **Điền kết quả thật** sau khi chạy test |
| **5.4 Đánh giá** | `01` mục 6 | Đối chiếu KPI G1–G7 với thực tế đạt được |
| **5.5 Hạn chế** | `01` mục 3.2 + `14` (các ô "Đánh đổi") | Nêu trung thực: chưa có IPN, token hạn 7 ngày, chia điện nước không theo ngày, cấu hình phải sửa code |
| **Kết luận** | Tổng hợp | **Viết mới** |
| **Hướng phát triển** | `01` mục 3.2 (cột "Dự kiến v2") | – |
| **Phụ lục A** | `02` mục 3 (bảng đầy đủ) | – |
| **Phụ lục B** | `API.md` mục 15 | – |
| **Phụ lục C** | `11` mục 4 | – |
| **Phụ lục D** | `13` mục 3, 7 | – |
| **Phụ lục E** | `09` mục 1, 3, 5 | Bảng % đóng góp từng thành viên |

---

## 3. Danh mục hình vẽ cần chuẩn bị

> Xuất các sơ đồ Mermaid thành ảnh PNG bằng [mermaid.live](https://mermaid.live) hoặc extension "Markdown Preview Mermaid Support" trong VS Code (độ phân giải tối thiểu 1920px chiều rộng).

| Hình | Tên | Nguồn |
|------|-----|-------|
| 1.1 | Sơ đồ quy trình quản lý KTX thủ công hiện tại | **Vẽ mới** (draw.io) |
| 1.2 | Kiến trúc Client–Server | **Vẽ mới** |
| 2.1 | Sơ đồ use case tổng quát | `02` mục 2 |
| 2.2 | Vòng đời sinh viên trong hệ thống | `03` mục 1.2 |
| 2.3 | Máy trạng thái giường | `03` mục 2.1 |
| 2.4 | Máy trạng thái hợp đồng | `03` mục 2.2 |
| 2.5 | Máy trạng thái hóa đơn | `03` mục 2.3 |
| 2.6 | Luồng đăng ký lưu trú (sequence) | `03` mục 4.1 |
| 2.7 | Luồng lập hóa đơn định kỳ | `03` mục 4.2 |
| 2.8 | Luồng thanh toán trực tuyến | `03` mục 4.3 |
| 2.9 | Luồng trả phòng và thanh lý | `03` mục 4.4 |
| 3.1 | Kiến trúc tổng thể hệ thống | `ARCHITECTURE.md` mục 1 |
| 3.2 | Sơ đồ thực thể quan hệ (ERD) | `DATA-SCHEMA.md` mục 1 |
| 3.3 | Mô hình phân quyền RBAC | `07` mục 1 |
| 3.4 | Luồng xác thực JWT | `07` mục 4 |
| 3.5 | Sitemap hệ thống | `08` mục 2 |
| 3.6 | Cấu trúc thư mục frontend | `ARCHITECTURE.md` mục 3.1 |
| 3.7 | Cấu trúc thư mục backend | `ARCHITECTURE.md` mục 3.2 |
| 4.1–4.20 | Ảnh chụp màn hình các chức năng | **Chụp từ hệ thống thật** |
| 4.21 | Sơ đồ triển khai | `13` mục 6 |
| 5.1 | Biểu đồ kết quả kiểm thử | **Vẽ từ số liệu thật** |

**Quy tắc chụp màn hình:**
- Dùng dữ liệu demo trông thật (tên Việt Nam, số tiền hợp lý) — **không** để "test123", "aaa".
- Chụp toàn bộ trình duyệt hoặc vùng nội dung, độ phân giải ≥ 1920×1080.
- Che hoặc thay dữ liệu nhạy cảm nếu có.
- Đánh số và chú thích đầy đủ: *Hình 4.5: Màn hình duyệt đơn đăng ký lưu trú*.

---

## 4. Mục 4.4 – Phần ăn điểm nhất của báo cáo

Giảng viên đánh giá cao những chỗ nhóm **giải quyết vấn đề kỹ thuật thực sự**, không phải CRUD đơn thuần. Bốn chủ đề dưới đây nên viết kỹ, mỗi chủ đề 2–3 trang:

### 4.4.1. Chống xếp trùng giường

**Cấu trúc trình bày:**
1. **Nêu vấn đề:** hai sinh viên cùng chọn một giường tại cùng thời điểm → race condition. Vẽ sơ đồ thời gian minh họa cách hai request xen kẽ nhau gây lỗi.
2. **Phân tích các giải pháp:**
   - Chỉ kiểm tra ở tầng ứng dụng → **không đủ**, vì có khoảng trống giữa lúc kiểm tra và lúc ghi.
   - Khóa toàn bảng → an toàn nhưng chặn hết các thao tác khác, hiệu năng kém.
   - Khóa hàng bi quan (`SELECT ... FOR UPDATE`) + partial unique index → đúng, nhưng cần SQL thô, cần migration thủ công và **chỉ chạy trên MongoDB**.
   - **Giải pháp đã chọn:** `UPDATE bed SET status=... WHERE id=? AND status='available'` trong transaction, rồi kiểm tra số dòng bị ảnh hưởng. Một câu `UPDATE` là thao tác nguyên tử nên chỉ một trong hai người đổi được dòng.
3. **Cài đặt:** trích đoạn code `ContractService.approve()` và câu lệnh tạo index.
4. **Kiểm chứng:** mô tả test case TC-72 (hai Staff cùng xếp sinh viên vào một giường) và kết quả.

### 4.4.2. Đảm bảo idempotent khi xử lý kết quả thanh toán

1. **Nêu vấn đề:** kết quả thanh toán có thể đến nhiều lần (người dùng tải lại trang kết quả, hoặc cổng thử lại). Nếu xử lý ngây thơ → ghi nhận thanh toán 2 lần → sinh viên được cộng tiền gấp đôi.
2. **Phân tích:** vì sao chữ ký HMAC là thứ bảo vệ thật sự (không có secret thì không giả mạo được), và vì sao Return URL kém bền hơn IPN (người dùng đóng trình duyệt thì không ai báo về).
3. **Giải pháp:** xác thực chữ ký HMAC trước mọi thứ, kiểm tra trạng thái giao dịch trong transaction để đảm bảo idempotent, đối chiếu số tiền, và bổ sung chức năng đối soát thủ công để bù cho đánh đổi trên.
4. **Cài đặt:** trích code `PaymentService.handleIpn()`.
5. **Kiểm chứng:** TC-103, TC-104, TC-105.

### 4.4.3. Thuật toán chia đều chi phí điện nước

1. **Nêu vấn đề:** tiền điện phòng chia cho N sinh viên thường không chia hết. Nếu làm tròn tùy tiện → tổng các phần không bằng tổng thực tế, gây lệch sổ sách.
2. **Phân tích:** so sánh `Math.round()` (có thể làm tổng lớn hơn thực tế) với `Math.floor()` + dồn phần dư.
3. **Giải pháp:** dùng `floor` cho từng người, phần dư dồn vào sinh viên có MSSV nhỏ nhất (BR-51) — đảm bảo bất biến: `Σ phần chia = tổng tiền phòng`.
4. **Cài đặt + chứng minh:** đưa ví dụ số cụ thể ở `03` mục 5.2 (7 sinh viên, 576.000đ).
5. **Kiểm chứng:** TC-86, TC-87 và unit test.

### 4.4.4. Tự động hóa nghiệp vụ bằng tác vụ nền

1. **Nêu vấn đề:** hợp đồng hết hạn, hóa đơn quá hạn, giao dịch treo — nếu chờ người dùng thao tác thì dữ liệu sẽ luôn lệch so với thực tế.
2. **Giải pháp:** 6 cron job (JOB-01 → JOB-06), mỗi job **idempotent** để chạy lại không gây sai.
3. **Vấn đề phát sinh:** khi deploy nhiều instance, job có thể chạy trùng → dùng cờ `ENABLE_CRON`.
4. **Cài đặt:** trích code một job tiêu biểu.
5. **Kiểm chứng:** TC-77, TC-78, TC-96, TC-108.

---

## 5. Tài liệu tham khảo mẫu

Định dạng theo chuẩn IEEE hoặc theo yêu cầu của khoa. Ví dụ:

```
[1]  Meta Open Source, "React Documentation", https://react.dev, truy cập ngày 15/09/2026.
[2]  OpenJS Foundation, "Node.js Documentation", https://nodejs.org/docs, truy cập ngày 15/09/2026.
[3]  OpenJS Foundation, "Express.js Guide", https://expressjs.com, truy cập ngày 15/09/2026.
[4]  MongoDB Global Development Group, "MongoDB 15 Documentation",
     https://www.postgresql.org/docs/15/, truy cập ngày 20/09/2026.
[5]  Mongoose Data Inc., "Mongoose ORM Documentation", https://www.mongoose.io/docs,
     truy cập ngày 20/09/2026.
[6]  M. Jones, J. Bradley, N. Sakimura, "RFC 7519: JSON Web Token (JWT)",
     Internet Engineering Task Force, 2015.
[7]  R. Fielding, "Architectural Styles and the Design of Network-based Software
     Architectures", Luận án Tiến sĩ, Đại học California, Irvine, 2000.
[8]  VNPAY, "Tài liệu tích hợp cổng thanh toán VNPAY",
     https://sandbox.vnpayment.vn/apis/, truy cập ngày 01/10/2026.
[10] OWASP Foundation, "OWASP Top 10:2021", https://owasp.org/Top10/,
     truy cập ngày 05/11/2026.
[11] D. F. Ferraiolo, D. R. Kuhn, "Role-Based Access Control", Proceedings of
     15th NIST-NCSC National Computer Security Conference, 1992.
[12] Ant Design Team, "Ant Design 5.0 Documentation", https://ant.design/docs/react/introduce,
     truy cập ngày 25/09/2026.
```

> **Lưu ý:** phải trích dẫn `[n]` trong thân bài tại đúng chỗ dùng đến, không chỉ liệt kê ở cuối.

---

## 6. Checklist trước khi nộp

### 6.1. Nội dung

| # | Hạng mục | ☐ |
|---|----------|---|
| 1 | Đủ các chương theo mục lục, không chương nào quá sơ sài | ☐ |
| 2 | Mọi hình vẽ đều được đánh số, có chú thích và **được nhắc đến trong thân bài** | ☐ |
| 3 | Mọi bảng biểu đều được đánh số và có chú thích | ☐ |
| 4 | Ảnh chụp màn hình dùng dữ liệu trông thật, rõ nét | ☐ |
| 5 | Mục 4.4 (vấn đề kỹ thuật) viết đủ sâu, có code minh họa | ☐ |
| 6 | Kết quả kiểm thử là số liệu **thật**, không bịa | ☐ |
| 7 | Phần hạn chế nêu trung thực | ☐ |
| 8 | Tài liệu tham khảo có trích dẫn trong thân bài | ☐ |
| 9 | Phụ lục E ghi rõ đóng góp từng thành viên | ☐ |

### 6.2. Hình thức

| # | Hạng mục | ☐ |
|---|----------|---|
| 1 | Đúng mẫu định dạng của khoa (font, cỡ chữ, lề, giãn dòng) | ☐ |
| 2 | Mục lục tự động, số trang khớp | ☐ |
| 3 | Danh mục hình vẽ, bảng biểu tự động | ☐ |
| 4 | Đánh số trang đầy đủ | ☐ |
| 5 | Không sai chính tả (dùng công cụ kiểm tra + đọc chéo giữa các thành viên) | ☐ |
| 6 | Thuật ngữ nhất quán xuyên suốt (không lúc "giường" lúc "chỗ ở") | ☐ |
| 7 | Đoạn code định dạng bằng font monospace, có tô màu cú pháp nếu được | ☐ |
| 8 | In thử 1 bản kiểm tra chất lượng hình ảnh | ☐ |

### 6.3. Sản phẩm kèm theo

| # | Hạng mục | ☐ |
|---|----------|---|
| 1 | Mã nguồn đầy đủ (2 repo hoặc file nén) | ☐ |
| 2 | File dump cơ sở dữ liệu có dữ liệu demo | ☐ |
| 3 | Hướng dẫn cài đặt chạy được trên máy mới | ☐ |
| 4 | Hướng dẫn sử dụng kèm ảnh minh họa | ☐ |
| 5 | URL hệ thống đã deploy + tài khoản demo | ☐ |
| 6 | Slide thuyết trình | ☐ |
| 7 | Video demo dự phòng (đề phòng lỗi mạng khi bảo vệ) | ☐ |

---

## 7. Gợi ý slide thuyết trình (15–20 phút)

| Slide | Nội dung | Thời lượng |
|-------|----------|------------|
| 1 | Trang bìa: tên đề tài, nhóm, GVHD | 30 giây |
| 2 | Đặt vấn đề: hiện trạng và 6 vấn đề tồn tại | 1,5 phút |
| 3 | Mục tiêu và phạm vi (8 module MVP) | 1,5 phút |
| 4 | Kiến trúc hệ thống | 1,5 phút |
| 5 | Công nghệ sử dụng | 1 phút |
| 6 | Sơ đồ CSDL (ERD) | 1,5 phút |
| 7 | Phân quyền RBAC | 1 phút |
| 8–13 | **Demo trực tiếp** theo kịch bản UAT-01 | 7 phút |
| 14 | Vấn đề kỹ thuật nổi bật (chọn 2 trong 4 mục 4.4) | 2,5 phút |
| 15 | Kết quả kiểm thử | 1 phút |
| 16 | Hạn chế và hướng phát triển | 1 phút |
| 17 | Cảm ơn + Hỏi đáp | – |

**Kịch bản demo (7 phút) — tập trước cho thuộc:**
1. Đăng nhập Staff → Dashboard (30 giây)
2. Staff xếp sinh viên vào giường → kích hoạt hợp đồng → 2 hóa đơn tự sinh (1,5 phút)
3. Staff duyệt đơn → hóa đơn tự sinh (1 phút)
4. Sinh viên thanh toán VNPay sandbox (2 phút)
5. Staff nhập chỉ số điện nước → lập hóa đơn hàng loạt (1,5 phút)
6. Dashboard cập nhật số liệu (30 giây)

> **Phòng ngừa rủi ro khi demo:** quay sẵn video toàn bộ kịch bản. Nếu mạng lỗi hoặc sandbox VNPay gặp sự cố, chiếu video thay thế mà không mất thời gian.

---

## 8. Câu hỏi phản biện thường gặp và gợi ý trả lời

| Câu hỏi | Gợi ý trả lời |
|---------|---------------|
| "Vì sao chọn React và Node.js?" | Nêu lý do kỹ thuật (cùng ngôn ngữ JS cho cả FE/BE giảm chi phí chuyển đổi tư duy, hệ sinh thái lớn, phù hợp ứng dụng nhiều tương tác) — xem `ARCHITECTURE.md` mục 2. |
| "Sao không dùng thư viện X (TanStack Query, Redux...)?" | Trả lời theo mẫu ở `14` mục 10: đã cân nhắc, chọn phương án đơn giản hơn vì nhóm kiểm soát được mã nguồn và ít khái niệm phải học; đánh đổi là mất bộ nhớ đệm tự động, không ảnh hưởng ở quy mô này. **Không** nói "vì thấy khó". |
| "Vì sao không dùng IPN cho thanh toán?" | Giải thích chữ ký HMAC mới là thứ bảo đảm an toàn; Return URL đủ an toàn, đánh đổi là kém bền khi người dùng đóng trình duyệt — đã bù bằng chức năng đối soát thủ công. Nêu đây là hạn chế đã biết. |
| "Làm sao đảm bảo 2 sinh viên không cùng một giường?" | Trình bày mục 4.4.1: transaction + khóa hàng + partial unique index. Đây là câu hỏi rất hay gặp. |
| "Nếu cổng thanh toán gửi thông báo 2 lần thì sao?" | Trình bày mục 4.4.2 về idempotent. |
| "Sinh viên có thể xem hóa đơn của bạn khác không?" | Không. Giải thích cơ chế lấy `studentId` từ JWT + kiểm tra ownership + test case TC-121 đến TC-124. |
| "Hệ thống chịu được bao nhiêu người dùng?" | Trả lời trung thực: đã kiểm thử ở mức 50 người đồng thời (NFR-04), chưa kiểm thử tải cao hơn. Nêu hướng mở rộng (thêm index, caching, chạy nhiều instance). |
| "Vì sao không làm mobile app?" | Nêu rõ đây là quyết định về phạm vi (`01` mục 3.2), web đã responsive; mobile app là hướng phát triển v2. |
| "Dữ liệu sinh viên lấy từ đâu?" | Staff nhập tay, hoặc nạp sẵn bằng script seed. Import Excel và tích hợp hệ thống đào tạo đều ngoài phạm vi v1 (`PRD.md` §3). |
| "Chức năng nào nhóm thấy khó nhất?" | Trả lời thật, chọn một trong 4 chủ đề ở mục 4.4 và giải thích quá trình gỡ vấn đề. |
| "Mỗi người làm gì?" | Dẫn Phụ lục E và ma trận RACI ở `09` mục 5. |

---

## 9. Lịch sử phiên bản

| Phiên bản | Ngày | Người thực hiện | Nội dung thay đổi |
|-----------|------|------------------|-------------------|
| v1.0 | 11/09/2026 | PM, BA | Khởi tạo khung báo cáo, bảng ánh xạ tài liệu, checklist nộp bài |
