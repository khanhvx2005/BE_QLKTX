# 12 – KHUNG BÁO CÁO ĐỒ ÁN CHUYÊN NGÀNH

**Học phần:** Đồ án chuyên ngành — Ngành Kỹ thuật phần mềm  
**Đề tài:** Xây dựng hệ thống web quản lý Ký túc xá Trường Đại học Công nghiệp Hà Nội (DMS-KTX HaUI)  
**Quy mô báo cáo:** 50 – 70 trang A4 (theo đúng đề cương hướng dẫn môn học)  
**Phiên bản:** v4.0 (Đồng bộ toàn diện với bản chuẩn hóa nghiệp vụ HaUI & Smart KTX 4.0)  
**Ngày cập nhật:** 03/10/2026

---

## 1. Cấu trúc Mục lục Báo cáo chuẩn (50 – 70 trang A4)

```text
TRANG BÌA (Theo mẫu chuẩn Khoa CNTT - HaUI)
NHẬN XÉT CỦA GIẢNG VIÊN HƯỚNG DẪN
LỜI CẢM ƠN
LỜI CAM ĐOAN
MỤC LỤC
DANH MỤC HÌNH VẼ
DANH MỤC BẢNG BIỂU
DANH MỤC TỪ VIẾT TẮT

CHƯƠNG 1. GIỚI THIỆU ĐỀ TÀI                                      (~6 - 8 trang)
  1.1. Lý do chọn đề tài
       1.1.1. Bối cảnh công tác quản lý KTX tại Trường Đại học Công nghiệp Hà Nội (HaUI)
       1.1.2. Những khó khăn, bất cập trong quy trình quản lý thủ công hiện nay
       1.1.3. Tính cấp thiết của đề tài và giải pháp số hóa KTX 4.0
  1.2. Mục tiêu đề tài
       1.2.1. Mục tiêu tổng quát
       1.2.2. Mục tiêu cụ thể (Đo lường bằng chỉ số KPI)
       1.2.3. Mục tiêu học thuật và kỹ năng ngành Kỹ thuật phần mềm
  1.3. Phạm vi đề tài
       1.3.1. Phạm vi chức năng triển khai (3 cơ sở: CS1, CS2, CS3 của HaUI)
       1.3.2. Giới hạn ngoài phạm vi
       1.3.3. Các giả định và ràng buộc nghiệp vụ
  1.4. Đối tượng sử dụng (4 Tác nhân hệ thống)
       1.4.1. System Administrator (admin - Quản trị kỹ thuật hệ thống)
       1.4.2. Manager (manager - Lãnh đạo / Trưởng Ban quản lý KTX)
       1.4.3. Staff (staff - Cán bộ KTX vận hành, hỗ trợ & bảo trì)
       1.4.4. Student (student - Sinh viên HaUI)
  1.5. Công nghệ dự kiến
       1.5.1. Công nghệ Frontend: React SPA, Vite, Ant Design, Socket.io-client
       1.5.2. Công nghệ Backend: Node.js, Express.js, JWT, Socket.io, Nodemailer
       1.5.3. Công nghệ Cơ sở dữ liệu & Caching: MongoDB, Mongoose ODM, Redis In-Memory
       1.5.4. Công nghệ Hàng đợi & Nâng cao: Redis BullMQ (Queue chịu tải), VietQR động, VNPay Sandbox

CHƯƠNG 2. KHẢO SÁT VÀ PHÂN TÍCH                                  (~15 - 18 trang)
  2.1. Mô tả bài toán quản lý KTX HaUI
       2.1.1. Cơ cấu không gian 4 cấp: Cơ sở (Campus) → Tòa (Building) → Phòng (Room) → Giường (Bed)
       2.1.2. Chu kỳ tài chính thực tế: Thu tiền phòng theo đợt hợp đồng (8.5T hoặc 10-12T), điện nước hàng tháng
  2.2. Quy trình nghiệp vụ thực tế
       2.2.1. Quy trình mở đợt, nộp đơn công khai và xét duyệt ưu tiên
       2.2.2. Quy trình tự động cấp tài khoản, gửi Email trúng tuyển và đổi mật khẩu lần đầu
       2.2.3. Quy trình thanh toán VietQR và quét mã QR Check-in nhận phòng
       2.2.4. Quy trình chốt chỉ số điện nước theo tòa và lập hóa đơn chia đều
       2.2.5. Quy trình xử lý các nghiệp vụ phát sinh: Chuyển phòng, Báo hỏng, Kỷ luật vi phạm
       2.2.6. Quy trình trả phòng, kiểm kê tài sản và quyết toán hoàn cọc
  2.3. Yêu cầu chức năng (Functional Requirements - FR)
       2.3.1. Bảng tổng hợp các yêu cầu chức năng (10 nhóm FR: M1 đến M10)
       2.3.2. Chi tiết các nhóm chức năng
  2.4. Yêu cầu phi chức năng (Non-Functional Requirements - NFR)
       2.4.1. Hiệu năng & Khả năng chịu tải cao (High Concurrency & Flash-Spike)
       2.4.2. Tính an toàn và bảo mật dữ liệu (RBAC, IDOR, Password Hash)
       2.4.3. Tính khả dụng và tương thích thiết bị (Web responsive)
  2.5. Xác định các tác nhân (Actors) & Phân cấp vai trò
  2.6. Sơ đồ ca sử dụng (Use Case Diagram)
       2.6.1. Sơ đồ Use Case tổng quát toàn hệ thống
       2.6.2. Sơ đồ Use Case phân hệ Đăng ký, Xét duyệt & Hợp đồng
       2.6.3. Sơ đồ Use Case phân hệ Điện nước, Tài chính & Thanh toán
       2.6.4. Sơ đồ Use Case phân hệ Nghiệp vụ phát sinh (Chuyển phòng, Báo hỏng, Kỷ luật)
       2.6.5. Sơ đồ Use Case phân hệ Tương tác Smart KTX (Chat, Thông báo, Check-in QR)
  2.7. Đặc tả ca sử dụng chi tiết (Use Case Descriptions - 8 UC trọng tâm)
       2.7.1. UC-01: Nộp đơn đăng ký KTX công khai qua hàng đợi Queue
       2.7.2. UC-02: Phê duyệt đơn trúng tuyển và tự động cấp tài khoản qua Email
       2.7.3. UC-03: Đăng nhập lần đầu và cưỡng bức đổi mật khẩu
       2.7.4. UC-04: Thanh toán tiền phòng và cọc qua mã VietQR động
       2.7.5. UC-05: Quét mã QR Check-in bàn giao giường nhận phòng
       2.7.6. UC-06: Nhập chỉ số điện nước theo lô và lập hóa đơn chia đều
       2.7.7. UC-07: Xử lý đơn chuyển phòng và bù trừ tiền chênh lệch
       2.7.8. UC-08: Trả phòng, kiểm kê tài sản và quyết toán hoàn cọc

CHƯƠNG 3. THIẾT KẾ HỆ THỐNG                                      (~15 - 18 trang)
  3.1. Kiến trúc hệ thống ở mức cơ bản và nâng cao
       3.1.1. Kiến trúc tổng thể Client - Server (RESTful API + WebSocket)
       3.1.2. Mô hình kiến trúc Modular Monolith (Vertical Slice theo tính năng)
       3.1.3. Mô hình Caching và Hàng đợi chịu tải cao (Redis + BullMQ)
       3.1.4. Mô hình phân quyền RBAC và cơ chế bảo mật JWT
  3.2. Sơ đồ hoạt động (Activity Diagrams)
       3.2.1. Sơ đồ hoạt động quy trình nộp đơn đợt cao điểm qua hàng đợi Queue
       3.2.2. Sơ đồ hoạt động quy trình duyệt đơn, gán giường và gửi email tự động
       3.2.3. Sơ đồ hoạt động quy trình tính toán và phân bổ tiền điện nước
       3.2.4. Sơ đồ hoạt động quy trình trả phòng và quyết toán hoàn cọc
  3.3. Sơ đồ tuần tự (Sequence Diagrams)
       3.3.1. Sequence Diagram: Nộp đơn công khai và đẩy vào Redis Queue
       3.3.2. Sequence Diagram: Duyệt đơn, cập nhật giường nguyên tử và gửi Email tài khoản
       3.3.3. Sequence Diagram: Đăng nhập và cưỡng bức đổi mật khẩu lần đầu
       3.3.4. Sequence Diagram: Thanh toán qua VietQR / VNPay và xử lý Webhook Idempotent
       3.3.5. Sequence Diagram: Quét mã QR Check-in nhận phòng
       3.3.6. Sequence Diagram: Nhắn tin trực tuyến thời gian thực (Socket.io)
  3.4. Thiết kế cơ sở dữ liệu
       3.4.1. Sơ đồ quan hệ thực thể (ERD CSDL MongoDB)
       3.4.2. Từ điển dữ liệu chi tiết (19 Collections chuẩn hóa tiếng Anh)
       3.4.3. Các ràng buộc toàn vẹn, Compound Index và Partial Unique Index
  3.5. Thiết kế giao diện (UI/UX)
       3.5.1. Sơ đồ cấu trúc điều hướng hệ thống (Sitemap Quản trị & Cổng sinh viên)
       3.5.2. Thiết kế giao diện phía Quản trị (Admin / Manager / Staff Portal)
       3.5.3. Thiết kế giao diện phía Sinh viên (Student Portal)

CHƯƠNG 4. XÂY DỰNG HỆ THỐNG                                       (~10 - 12 trang)
  4.1. Môi trường phát triển
       4.1.1. Môi trường phần cứng, phần mềm và công cụ phát triển
       4.1.2. Cấu hình Docker & Docker Compose (Node.js, MongoDB, Redis)
  4.2. Công nghệ sử dụng trong hiện thực hóa
       4.2.1. Tổ chức mã nguồn Frontend (React + Vite + Ant Design)
       4.2.2. Tổ chức mã nguồn Backend (Node.js + Express theo Feature Module)
  4.3. Các chức năng đã xây dựng
       4.3.1. Phân hệ Cơ cấu không gian (Cơ sở, Tòa nhà, Phòng, Giường tầng)
       4.3.2. Phân hệ Đợt mở KTX, Nộp đơn công khai & Hàng đợi BullMQ
       4.3.3. Phân hệ Tự động cấp tài khoản, gửi Email và Đổi mật khẩu
       4.3.4. Phân hệ Hợp đồng lưu trú & Check-in QR
       4.3.5. Phân hệ Ghi số điện nước theo lô & Lập hóa đơn chia đều
       4.3.6. Phân hệ Thanh toán VietQR động và Cổng VNPay
       4.3.7. Phân hệ Đơn phát sinh: Chuyển phòng, Báo hỏng thiết bị, Kỷ luật vi phạm
       4.3.8. Phân hệ Smart KTX: Chat Socket.io, Thông báo chuông, Bảng tin KTX
       4.3.9. Dashboard thống kê và xuất báo cáo
  4.4. Một số giao diện chính của hệ thống (Hình ảnh chụp thực tế)
  4.5. Một số xử lý thuật toán và kỹ thuật quan trọng
       4.5.1. Giải pháp dàn phẳng tải cao điểm bằng Redis Queue (BullMQ)
       4.5.2. Kỹ thuật Caching Redis giảm 95% tải tra cứu phòng trống
       4.5.3. Thuật toán tự động ưu tiên gán giường tầng dưới theo chỉ định thể chất (BR-16)
       4.5.4. Thuật toán cập nhật nguyên tử chống xếp trùng giường (`Bed.status`)
       4.5.5. Thuật toán chia đều làm tròn tiền điện nước chính xác đến từng đồng
       4.5.6. Kỹ thuật sinh mã VietQR động và xử lý Webhook Idempotent

CHƯƠNG 5. KIỂM THỬ VÀ ĐÁNH GIÁ                                    (~6 - 8 trang)
  5.1. Kế hoạch và phương pháp kiểm thử
       5.1.1. Phương pháp kiểm thử chức năng (Black-box Testing)
       5.1.2. Môi trường và công cụ kiểm thử (Postman, Jest, k6 / Apache JMeter)
  5.2. Các kịch bản kiểm thử (Test Cases tiêu biểu)
       5.2.1. Test Case luồng nộp đơn cao điểm qua hàng đợi Queue
       5.2.2. Test Case chống xếp trùng giường đồng thời (Race condition)
       5.2.3. Test Case tự động ưu tiên giường tầng dưới cho sinh viên có vấn đề thể chất
       5.2.4. Test Case tự cấp tài khoản, gửi email và cưỡng bức đổi mật khẩu lần đầu
       5.2.5. Test Case thuật toán chia đều tiền điện nước không lệch đồng nào
       5.2.6. Test Case thanh toán VietQR, xử lý Webhook trùng lặp (Idempotent)
       5.2.7. Test Case kiểm tra phân quyền RBAC và chống lỗ hổng IDOR
  5.3. Kết quả kiểm thử thực tế
       5.3.1. Bảng tổng hợp kết quả kiểm thử chức năng (Pass/Fail)
       5.3.2. Đánh giá kiểm thử tải cao (Stress test với k6/JMeter)
  5.4. Những chức năng đã hoàn thành
  5.5. Những hạn chế còn tồn tại

CHƯƠNG 6. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN                            (~2 - 3 trang)
  6.1. Kết quả đạt được so với mục tiêu ban đầu
  6.2. Hạn chế của đề tài
  6.3. Hướng phát triển trong tương lai (Tích hợp thẻ từ RFID, Ứng dụng Mobile App, AI Chatbot)

TÀI LIỆU THAM KHẢO
PHỤ LỤC (Hướng dẫn cài đặt & Chạy demo hệ thống)
```

---

## 2. Bảng Ánh xạ: Tài liệu trong thư mục `docs/` $\rightarrow$ 6 Chương báo cáo

| Chương báo cáo | Thu thập nội dung từ các file tài liệu | Nội dung trọng tâm cần lấy vào báo cáo |
| :--- | :--- | :--- |
| **Chương 1: Giới thiệu đề tài** | `docs/PRD.md`<br>`docs/01-TONG-QUAN-DU-AN.md` | Bối cảnh 3 cơ sở HaUI, thực trạng sổ sách/Excel, mục tiêu KPI, phạm vi 4 cấp không gian, 4 vai trò tác nhân (`admin`, `manager`, `staff`, `student`), công nghệ (React, Node.js, MongoDB, Redis, Socket.io, BullMQ, VietQR). |
| **Chương 2: Khảo sát và phân tích** | `docs/01-TONG-QUAN-DU-AN.md`<br>`docs/02-DAC-TA-YEU-CAU.md`<br>`docs/03-PHAN-TICH-NGHIEP-VU.md` | Bài toán HaUI, quy trình 8 bước, bảng FR (10 nhóm M1-M10), NFR (chịu tải, bảo mật), Use Case Diagrams, 8 Use Case Description chi tiết (Queue nộp đơn, Duyệt cấp tài khoản qua email, Đổi pass, VietQR, QR Checkin, Điện nước, Chuyển phòng, Trả phòng). |
| **Chương 3: Thiết kế hệ thống** | `docs/ARCHITECTURE.md`<br>`docs/DATA-SCHEMA.md`<br>`docs/07-PHAN-QUYEN-BAO-MAT.md`<br>`docs/08-THIET-KE-GIAO-DIEN.md` | Kiến trúc Modular Monolith, JWT, RBAC 4 vai trò, Redis Cache + BullMQ, Activity Diagrams, Sequence Diagrams, ERD CSDL MongoDB (**19 Collections** tiếng Anh chuẩn), thiết kế Sitemap UI. |
| **Chương 4: Xây dựng hệ thống** | `docs/ARCHITECTURE.md`<br>`docs/13-LO-TRINH-TRIEN-KHAI.md`<br>`docs/03-PHAN-TICH-NGHIEP-VU.md`<br>`src/` (Mã nguồn thực tế) | Cấu hình Docker, tổ chức thư mục code, ảnh chụp các màn hình chức năng, giải thuật sâu: Queue BullMQ, Caching Redis, Thuật toán ưu tiên giường tầng dưới (BR-16), Atomic update chống trùng giường, chia tiền điện nước, VietQR động. |
| **Chương 5: Kiểm thử và đánh giá** | `docs/11-KE-HOACH-KIEM-THU.md`<br>`docs/02-DAC-TA-YEU-CAU.md` | Bảng Test Case tiêu biểu (Queue tải cao, Race condition giường, Ưu tiên giường dưới, Email cấp tài khoản, Chia tiền điện nước, Webhook thanh toán, IDOR), kết quả đo tải, đánh giá mức độ hoàn thành. |
| **Chương 6: Kết luận** | `docs/PRD.md`<br>`docs/01-TONG-QUAN-DU-AN.md` | Kết quả đạt được so với yêu cầu, hạn chế, hướng mở rộng (Mobile app, Thẻ từ RFID, AI Chatbot). |

---

## 3. Danh mục Sơ đồ UML & Hình vẽ bắt buộc trong báo cáo

| Mã hình | Tên sơ đồ / Hình vẽ | Vị trí trong báo cáo | Nguồn tư liệu trực tiếp |
| :--- | :--- | :--- | :--- |
| **Hình 1.1** | Kiến trúc tổng thể hệ thống (Client - Server - Redis - MongoDB) | Mục 1.5 | `docs/ARCHITECTURE.md` |
| **Hình 2.1** | Sơ đồ Use Case tổng quát hệ thống DMS-KTX HaUI (4 Actors) | Mục 2.6.1 | `docs/02-DAC-TA-YEU-CAU.md` §1-2 |
| **Hình 2.2** | Sơ đồ Use Case phân hệ Đăng ký, Xét duyệt & Hợp đồng | Mục 2.6.2 | `docs/02-DAC-TA-YEU-CAU.md` §2.5 |
| **Hình 2.3** | Sơ đồ Use Case phân hệ Điện nước, Tài chính & Thanh toán VietQR | Mục 2.6.3 | `docs/02-DAC-TA-YEU-CAU.md` §2.7 |
| **Hình 2.4** | Sơ đồ Use Case phân hệ Nghiệp vụ phát sinh (Chuyển phòng, Báo hỏng, Kỷ luật) | Mục 2.6.4 | `docs/02-DAC-TA-YEU-CAU.md` §2.8 |
| **Hình 2.5** | Sơ đồ Use Case phân hệ Tương tác Smart KTX (Chat, Thông báo, Check-in QR) | Mục 2.6.5 | `docs/02-DAC-TA-YEU-CAU.md` §2.9 |
| **Hình 3.1** | Kiến trúc Modular Monolith và cơ chế Hàng đợi Redis Queue | Mục 3.1.2 | `docs/ARCHITECTURE.md` |
| **Hình 3.2** | Sơ đồ ma trận phân quyền RBAC 4 vai trò | Mục 3.1.4 | `docs/07-PHAN-QUYEN-BAO-MAT.md` |
| **Hình 3.3** | Activity Diagram: Nộp đơn đợt cao điểm qua hàng đợi BullMQ | Mục 3.2.1 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §1 |
| **Hình 3.4** | Activity Diagram: Duyệt đơn, gán giường và tự sinh tài khoản qua Email | Mục 3.2.2 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §1 |
| **Hình 3.5** | Activity Diagram: Tính toán và phân bổ tiền điện nước phòng | Mục 3.2.3 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §3.4 |
| **Hình 3.6** | Activity Diagram: Trả phòng, kiểm kê và quyết toán hoàn cọc | Mục 3.2.4 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §3.8 |
| **Hình 3.7** | Sequence Diagram: Nộp đơn công khai và đẩy vào hàng đợi Queue | Mục 3.3.1 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §3.2 |
| **Hình 3.8** | Sequence Diagram: Duyệt trúng tuyển, chiếm giường nguyên tử và gửi Email | Mục 3.3.2 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §3.2 |
| **Hình 3.9** | Sequence Diagram: Đăng nhập và cưỡng bức đổi mật khẩu lần đầu | Mục 3.3.3 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §3.2 |
| **Hình 3.10** | Sequence Diagram: Thanh toán qua VietQR/VNPay và xử lý Webhook Idempotent | Mục 3.3.4 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §3.5 |
| **Hình 3.11** | Sequence Diagram: Quét mã QR Check-in nhận phòng tại KTX | Mục 3.3.5 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §3.6 |
| **Hình 3.12** | Sequence Diagram: Nhắn tin trực tuyến thời gian thực (Socket.io) | Mục 3.3.6 | `docs/03-PHAN-TICH-NGHIEP-VU.md` §3.7 |
| **Hình 3.13** | Sơ đồ quan hệ thực thể CSDL (ERD MongoDB - 19 Collections) | Mục 3.4.1 | `docs/DATA-SCHEMA.md` §2 |
| **Hình 3.14** | Sơ đồ cấu trúc điều hướng giao diện (Sitemap Quản trị & Cổng sinh viên) | Mục 3.5.1 | `docs/08-THIET-KE-GIAO-DIEN.md` |
| **Hình 4.1 – 4.15** | Ảnh chụp màn hình giao diện các chức năng thực tế của hệ thống | Mục 4.4 | Chụp trực tiếp từ ứng dụng chạy thực tế |

---

## 4. Các điểm kỹ thuật nâng cao "Ghi điểm tuyệt đối" trong Chương 4

Hội đồng chấm đồ án ngành Kỹ thuật phần mềm HaUI luôn đánh giá rất cao các giải pháp kỹ thuật giải quyết bài toán thực tế thay vì chỉ CRUD thông thường. Cần trình bày chi tiết ở **Mục 4.5**:

### 4.5.1. Dàn phẳng tải cao điểm bằng Redis Queue (BullMQ)
* **Vấn đề:** Vào thời điểm mở cổng KTX, hàng nghìn sinh viên cùng bấm nộp đơn trong 5 phút. Nếu ghi trực tiếp vào MongoDB sẽ gây Connection Pool Exhaustion, khóa DB và sập máy chủ.
* **Giải pháp:** API nộp đơn chỉ xác thực sơ bộ rồi đẩy payload vào Queue `queue:dorm-application` (mất ~5ms) và phản hồi mã vé hàng đợi cho người dùng. Worker chạy ngầm tuần tự nhặt từng đơn xử lý xuống MongoDB với tốc độ tối đa 100 req/s, đảm bảo hệ thống mượt mà 100%.

### 4.5.2. Caching Redis danh sách phòng trống
* **Vấn đề:** Sinh viên liên tục F5 để tra cứu xem còn phòng/giường trống nào. Việc chạy lệnh đếm và populate liên tục trên MongoDB gây quá tải CPU.
* **Giải pháp:** Áp dụng mô hình Cache-Aside trên Redis với key `rooms:available:campus:{id}`, TTL 15–30 giây. Khi có thay đổi trạng thái giường, hệ thống tự động xóa cache. Tốc độ đọc từ RAM đạt < 2ms, giảm 95% tải truy vấn cơ sở dữ liệu.

### 4.5.3. Thuật toán tự động ưu tiên giường tầng dưới cho Sinh viên có vấn đề thể chất (BR-16)
* **Tính nhân văn & Accessibility:** Khi sinh viên khai báo `hasHealthCondition: true` (khuyết tật vận động, bệnh tim mạch, chấn thương...) kèm giấy xác nhận y tế, thuật toán tự động lọc và **chỉ cho phép gán giường tầng dưới (`Bed.position == 'lower'`)**, tuyệt đối chặn xếp lên tầng trên (`upper`). Với tòa không có thang máy (`hasElevator == false`), tự động ưu tiên xếp phòng Tầng 1 hoặc Tầng 2.

### 4.5.4. Chống xếp trùng giường bằng Cập nhật nguyên tử (Atomic Conditional Update)
* Sử dụng thao tác `findOneAndUpdate({ _id: bedId, status: 'available' }, { status: 'occupied' })` ở tầng database. Cơ chế đơn luồng nguyên tử của MongoDB trên 1 document triệt tiêu hoàn toàn khả năng 2 sinh viên bị xếp cùng 1 giường dù request đến cùng 1 mili-giây.

### 4.5.5. Thuật toán chia đều làm tròn tiền điện nước không lệch một đồng
* Áp dụng hàm `Math.floor` cho từng người và dồn phần tiền dư lẻ vào sinh viên có MSSV nhỏ nhất trong phòng (BR-32). Đảm bảo tổng số tiền thu từ các sinh viên luôn khớp 100% với hóa đơn tổng của phòng.

### 4.5.6. Thanh toán VietQR động và Xử lý Webhook Idempotent
* Tự động sinh mã VietQR động theo chuẩn NAPAS nhúng sẵn STK KTX, số tiền chính xác và mã hóa đơn làm nội dung chuyển khoản.
* Webhook thanh toán từ cổng được đẩy vào `queue:payment-webhook`. Sử dụng mã giao dịch ngân hàng và trạng thái hóa đơn để đảm bảo Idempotent, chống việc nhận tiền 2 lần khi cổng bắn lại webhook.

---

## 5. Danh mục Câu hỏi Phản biện thường gặp & Gợi ý trả lời

1. **"Vì sao hệ thống không cho sinh viên tự do đăng ký tài khoản mà phải nộp đơn công khai trước rồi mới cấp tài khoản qua Email?"**
   * *Gợi ý trả lời:* Đây là quy trình nghiệp vụ thực tế của trường đại học công lập. KTX không phải mạng xã hội để đăng ký tự do, làm vậy sẽ bị spam tài khoản ảo và rác CSDL. Sinh viên nộp đơn công khai bằng MSSV, chỉ khi Ban quản lý KTX duyệt trúng tuyển thì hệ thống mới tự sinh tài khoản (`Username = MSSV`, pass tạm thời, `mustChangePassword = true`) và gửi Email thông báo. Khi đăng nhập lần đầu, sinh viên bị cưỡng bức đổi mật khẩu mới để bảo mật tuyệt đối.

2. **"Hệ thống giải quyết bài toán hàng nghìn sinh viên cùng F5 và nộp đơn trong ngày mở cổng KTX như thế nào để không bị sập?"**
   * *Gợi ý trả lời:* Nhóm áp dụng 2 kỹ thuật cốt lõi: (1) Caching danh sách phòng trống trên Redis In-memory giúp phục vụ hàng nghìn lượt tra cứu/giây với độ trễ < 2ms mà không chạm vào MongoDB; (2) Sử dụng Message Queue (BullMQ trên nền Redis) để nhận request nộp đơn trong 5ms rồi xếp hàng xử lý tuần tự xuống DB, dàn phẳng đỉnh tải (Traffic Smoothing) giúp máy chủ luôn ổn định.

3. **"Làm thế nào để hệ thống đảm bảo tính nhân văn trong việc xếp chỗ ở cho sinh viên có hoàn cảnh đặc biệt?"**
   * *Gợi ý trả lời:* Hệ thống tích hợp quy tắc nghiệp vụ BR-16: Sinh viên có vấn đề về sức khỏe/vận động kèm giấy xác nhận y tế sẽ được hệ thống tự động khóa và chỉ cho phép gán vào giường tầng dưới (`Bed.position == 'lower'`), chặn tuyệt đối xếp lên tầng trên; đồng thời ưu tiên xếp vào phòng ở Tầng 1 hoặc Tầng 2 đối với các tòa KTX không có thang máy.

4. **"Tại sao nhóm sử dụng MongoDB cho hệ thống KTX thay vì CSDL quan hệ như SQL Server hay PostgreSQL?"**
   * *Gợi ý trả lời:* MongoDB cung cấp cấu trúc Document BSON linh hoạt, hỗ trợ lưu trữ các đối tượng phức hợp lồng nhau (như danh sách chi tiết các dòng phí trong hóa đơn, lịch sử hợp đồng, thông tin liên hệ khẩn cấp) mà không cần JOIN nhiều bảng nặng nề. Đồng thời, thao tác cập nhật nguyên tử `findOneAndUpdate` của MongoDB cực kỳ tối ưu cho bài toán chiếm giường tức thời.

5. **"Làm sao đảm bảo giao dịch thanh toán VietQR / VNPay không bị ghi nhận tiền 2 lần do mạng chập chờn?"**
   * *Gợi ý trả lời:* Hệ thống thiết kế xử lý Webhook theo nguyên lý Idempotent: Khi webhook gọi về, server kiểm tra trạng thái thanh toán và mã giao dịch ngân hàng (`gatewayTransactionId` có unique index). Nếu giao dịch đã được ghi nhận `success` trước đó, hệ thống lập tức phản hồi `200 OK` và thoát sớm mà không cập nhật lại số dư hóa đơn lần thứ hai.
