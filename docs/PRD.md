# Product Requirements Document (PRD) — HaUI - DMS

- **Tên hệ thống:** Hệ thống Quản lý Ký túc xá Đại học Công nghiệp Hà Nội (`HaUI - DMS`)
- **Phiên bản:** v2.7 (Chuẩn hóa thực tế triển khai & Báo cáo Đồ án Chuyên ngành)
- **Kiến trúc:** React (Vite + Ant Design) · Node.js + Express (Modular Monolith) · MongoDB + Mongoose

---

## 1. Bối Cảnh & Bài Toán Thực Tế

Ký túc xá Trường Đại học Công nghiệp Hà Nội (HaUI) quản lý hàng ngàn chỗ ở tại các tòa nhà cao tầng (`K1`, `K2`, `K3`, `K4`...). Quá trình vận hành truyền thống gặp 3 điểm nghẽn chính:
1. **Áp lực tiếp nhận đầu kỳ:** Thu hồ sơ giấy hoặc biểu mẫu tự do dễ phát sinh hồ sơ rác, mạo danh và quá tải tiếp nhận.
2. **Xung đột xếp phòng thủ công:** Nhiều cán bộ cùng xếp chỗ trên sổ sách/Excel dễ dẫn tới trùng giường (*Overbooking*) hoặc xếp nhầm giới tính phòng nam/nữ.
3. **Bất cập thu phí điện nước lẻ:** Chia nhỏ hóa đơn điện nước cho từng cá nhân gây phát sinh tiền lẻ, nợ đọng kéo dài và khó đối soát.

---

## 2. Mục Tiêu Hệ Thống

1. **Cổng tiếp nhận công khai (Public Portal):** Cho phép sinh viên chưa có tài khoản tra cứu phòng còn chỗ theo giới tính (sắp xếp theo quy tắc ngăn xếp: tầng thấp, số phòng nhỏ trước) và nộp đơn đăng ký trực tuyến, tra cứu tiến độ xử lý đơn.
2. **Phê duyệt nguyên tử & Cấp tài khoản tự động:** Cán bộ duyệt đơn kích hoạt khóa giường nguyên tử một bước (`$elemMatch` + `findOneAndUpdate`), tự động sinh tài khoản (`TK = MK = MSSV`, bật cờ `mustChangePassword = true`), gửi email qua SMTP và phát hành 02 hóa đơn cá nhân (tiền cọc & tiền phòng cả kỳ).
3. **Quản lý điện nước theo đơn vị Phòng:** Nhập chỉ số dạng bảng lưới (*Matrix Grid*) theo tòa/tháng, chốt đúng **01 hóa đơn điện nước/phòng/tháng** kèm mức tiền chia bình quân tham khảo; hỗ trợ 01 sinh viên đại diện phòng thanh toán qua mã **VietQR động** (chuẩn NAPAS) hoặc nộp tiền mặt tại văn phòng KTX.
4. **Thống kê trực quan thời gian thực:** Theo dõi tỷ lệ lấp đầy giường theo từng tòa nhà, công nợ tồn đọng và báo cáo doanh thu theo tháng/năm (tách biệt tiền cọc khỏi doanh thu thực).

---

## 3. Tác Nhân Hệ Thống (Actors)

| Tác nhân | Mã vai trò (`role`) | Quyền hạn cốt lõi | Phương thức cấp tài khoản |
|---|---|---|---|
| **Quản trị viên** | `admin` | Toàn quyền hệ thống: quản lý tài khoản cán bộ/sinh viên, cấu hình tòa nhà & phòng, vận hành nghiệp vụ và xem báo cáo doanh thu. | Khởi tạo qua `seed.js` hoặc do Admin khác tạo. |
| **Cán bộ KTX** | `staff` | Xét duyệt/từ chối đơn KTX, quản lý hồ sơ SV & import Excel, quản lý tòa/phòng, ghi & chốt điện nước, thu tiền mặt, đối soát VietQR, thanh lý hợp đồng & hoàn cọc, đặt lại mật khẩu tạm cho SV. | Do `admin` tạo trên giao diện quản trị. |
| **Sinh viên nội trú** | `student` | Đổi mật khẩu lần đầu, xem hồ sơ cá nhân, phòng ở & bạn cùng phòng, xem hóa đơn cá nhân/phòng, lấy mã VietQR động và xem lịch sử thanh toán/điện nước. | Tự động sinh và gửi qua Email khi đơn đăng ký KTX được phê duyệt. |
| **Sinh viên đăng ký mới** | *(Guest — không cần token)* | Tra cứu phòng trống theo giới tính, nộp đơn đăng ký KTX trực tuyến và tra cứu trạng thái đơn bằng `MSSV + Email`. | Không yêu cầu đăng nhập. |

---

## 4. Phạm Vi Chức Năng (In-Scope — 8 Phân Hệ)

- **M1 — Xác thực & Tài khoản (`/api/auth`, `/api/users`):** Đăng nhập bằng Email hoặc MSSV, cưỡng bức đổi mật khẩu lần đầu, quản lý tài khoản `admin`/`staff`/`student`, đặt lại mật khẩu tạm thời.
- **M2 — Hồ sơ Sinh viên (`/api/students`):** Danh sách, chi tiết (kèm hợp đồng & công nợ), thêm/sửa, nhập hàng loạt từ dữ liệu Excel (tối đa 1.000 dòng/lần), vô hiệu hóa hồ sơ khi sạch nợ.
- **M3 — Tòa nhà & Phòng KTX (`/api/buildings`, `/api/rooms`):** Quản lý tòa nhà (`K1`–`K4`), tạo/sửa phòng sức chứa `4 | 6 | 8` chỗ theo giới tính (`male | female`) với mảng giường nhúng trực tiếp (`beds[]`).
- **M4 — Đăng ký KTX Online & Hợp đồng (`/api/public`, `/api/contracts`):** Tra cứu phòng trống ngăn xếp, nộp đơn công khai (`6_months | 12_months`), tra cứu trạng thái đơn, duyệt đơn (khóa giường nguyên tử + cấp TK + gửi mail + lập 2 hóa đơn), từ chối đơn (kèm lý do + gửi mail), thanh lý trả phòng khi sạch nợ, xác nhận hoàn cọc 1 lần.
- **M5 — Điện nước & Hóa đơn (`/api/utility-readings`, `/api/invoices`):** Bảng lưới nhập chỉ số điện nước hàng loạt theo tòa, chốt & phát hành hóa đơn điện nước theo phòng (`scope: 'room'`), lịch sử điện nước, tra cứu hóa đơn kèm tổng hợp công nợ.
- **M6 — Thanh toán (`/api/payments`):** Thu tiền mặt tại quầy, xác nhận đối soát chuyển khoản VietQR (chặn trùng mã giao dịch ngân hàng), tra cứu biên lai phiếu thu.
- **M7 — Cổng Sinh viên (`/api/portal`):** Xem hồ sơ, chỗ ở & bạn cùng phòng, lịch sử hợp đồng, danh sách hóa đơn cá nhân & phòng, sinh dữ liệu VietQR động chuẩn NAPAS, lịch sử phiếu thu và điện nước phòng đang ở.
- **M8 — Dashboard & Thống kê (`/api/dashboard`):** Tổng quan KPI chỗ ở/công nợ, tỷ lệ lấp đầy theo tòa nhà và doanh thu thực theo tháng (chỉ `admin`).

---

## 5. Ranh Giới Ngoài Hệ Thống (Out-of-Scope)

1. **Không đồng bộ trực tiếp thời gian thực với Cổng đào tạo HaUI:** Hồ sơ sinh viên được tiếp nhận qua biểu mẫu đăng ký KTX hoặc nhập hàng loạt từ file Excel chuẩn.
2. **Không tích hợp Webhook/IPN ngân hàng tự động:** Sinh viên quét mã VietQR động chuyển khoản đúng số tiền & cú pháp; cán bộ KTX kiểm tra sao kê và bấm xác nhận gạch nợ trên hệ thống.
3. **Không tích hợp phần cứng kiểm soát ra vào:** Không bao gồm cổng từ, camera nhận diện hay thiết bị IoT đo điện nước tự động.
4. **Không mở đăng ký tài khoản tự do:** Ngăn chặn triệt để tài khoản rác và mạo danh sinh viên.
