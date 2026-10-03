# Product Requirements Document (PRD) — HaUI Dormitory Management System (DMS)

**Đơn vị áp dụng:** Trường Đại học Công nghiệp Hà Nội (HaUI)  
**Phiên bản:** 2.2 (Chuẩn hóa luồng Cấp tài khoản qua Email & Smart KTX)  
**Kiến trúc:** Modular Monolith (Node.js + Express + MongoDB/Mongoose + React Vite + Redis Cache & Queue + Socket.io + Nodemailer Email Service)  
**Quy mô đội:** 5 thành viên (3 Backend, 2 Frontend)

---

## 1. Bối cảnh & Mục tiêu

Hệ thống quản lý Ký túc xá Đại học Công nghiệp Hà Nội (HaUI) phục vụ công tác quản lý lưu trú tập trung tại 3 cơ sở đào tạo:
- **Cơ sở 1:** Số 298 đường Cầu Diễn, quận Bắc Từ Liêm, TP. Hà Nội.
- **Cơ sở 2:** Phường Tây Tựu, quận Bắc Từ Liêm, TP. Hà Nội.
- **Cơ sở 3:** Phường Phù Vân, TP. Phủ Lý, tỉnh Hà Nam.

**Mục tiêu chính:**
1. **Quy trình nộp đơn công khai & Cấp tài khoản qua Email:** Sinh viên nộp đơn online trong đợt mở bằng MSSV mà không cần tạo tài khoản trước. Khi Ban quản lý KTX duyệt trúng tuyển, hệ thống **tự động khởi tạo tài khoản** (`Username = MSSV`, mật khẩu mặc định, `mustChangePassword = true`) và **gửi Email thông báo trúng tuyển** kèm thông tin đăng nhập, hướng dẫn đổi mật khẩu và quét mã VietQR nộp tiền.
2. **Chống sập đợt cao điểm:** Sử dụng **Redis Caching và Message Queue (BullMQ)** để xếp hàng xử lý hàng nghìn đơn đăng ký nộp đồng thời trong 5–10 phút đầu mà không nghẽn database.
3. **Quản lý không gian ở 4 cấp chuẩn mực:** **Cơ sở (Campus) → Tòa nhà (Building) → Phòng (Room) → Giường (Bed)**, kiểm soát giới tính phòng và cập nhật trạng thái giường bằng thao tác nguyên tử (atomic update).
4. **Chu kỳ tài chính thực tế HaUI:** Thu tiền phòng trọn gói theo đợt hợp đồng (8.5 tháng với tân sinh viên cơ sở Hà Nam, 10–12 tháng với sinh viên từ năm 2 trở đi tại CS1/CS2) và tiền cọc tài sản; chốt số và chia đều tiền điện nước hàng tháng.
5. **Trải nghiệm KTX 4.0 hiện đại:**
   - **Tương tác trực tiếp:** Tích hợp kênh Chat trực tuyến (Socket.io) giữa sinh viên và cán bộ trực KTX.
   - **Thông báo đẩy & Bảng tin:** Chuông thông báo In-app và Bảng tin KTX nội bộ.
   - **Check-in nhận phòng bằng mã QR:** Quét mã QR trên điện thoại sinh viên để bàn giao phòng/giường trong 3 giây.
   - **Thanh toán VietQR động:** Quét mã QR ngân hàng tự động điền đúng số tiền và nội dung hóa đơn.
6. **Nghiệp vụ phát sinh thực tế:** Chuyển phòng/giường, báo hỏng sửa chữa cơ sở vật chất, lập biên bản vi phạm nội quy/điểm rèn luyện KTX, quyết toán cọc và cấp xác nhận không nợ KTX khi ra trường.

---

## 2. Phạm vi tính năng cốt lõi (Core Features)

### 2.1. Đợt mở KTX, Nộp đơn công khai & Hàng đợi Queue
- **Năm học (`AcademicYear`) & Đợt đăng ký (`RegistrationPeriod`):** Mở theo cơ sở và thời gian quy định.
- **Nộp đơn công khai (Public Application):** Sinh viên truy cập Cổng KTX, nhập MSSV, Họ tên, Ngày sinh, SĐT, Email, Khoa, Lớp, chọn Cơ sở, nguyện vọng loại phòng, tải ảnh minh chứng ưu tiên. **Không cần tạo tài khoản trước**.
- **Hàng đợi chống nghẽn (Redis BullMQ):** Đơn nộp đợt cao điểm được đẩy vào `queue:dorm-application`, server phản hồi mã vé hàng đợi ngay lập tức (phản hồi trong 5ms). Worker ngầm tuần tự ghi vào MongoDB.
- **Xác nhận qua Email:** Hệ thống tự động gửi email xác nhận đã tiếp nhận đơn đăng ký thành công.

### 2.2. Xét duyệt, Tự động cấp tài khoản & Gửi Email trúng tuyển
- **Cán bộ KTX xét duyệt:** Lọc hồ sơ theo thứ tự ưu tiên chính sách HaUI (`policy_family` > `poor_household` > `remote_area` > tân SV tỉnh xa).
- **Khi DUYỆT TRÚNG TUYỂN:** Hệ thống tự động kích hoạt chuỗi tác vụ:
  1. Chỉ định giường trống phù hợp (`Bed.status = 'occupied'`).
  2. Khởi tạo Hợp đồng lưu trú (`Contract`) và Hóa đơn kỳ đầu (`Invoice`).
  3. **Tự động khởi tạo Tài khoản người dùng (`User`):**
     - `email`: Email sinh viên đã nộp.
     - `role`: `student`.
     - `mustChangePassword`: `true`.
  4. **Gửi Email thông báo trúng tuyển KTX tự động:**
     - Thông báo chúc mừng trúng tuyển kèm thông tin: Cơ sở, Tòa nhà, Phòng, Giường.
     - Cung cấp tài khoản: Tên đăng nhập (MSSV) và Mật khẩu khởi tạo tạm thời.
     - Hướng dẫn đăng nhập đổi mật khẩu và hạn chót nộp tiền phòng (trong vòng 7 ngày qua VietQR).
- **Khi TỪ CHỐI:** Hệ thống gửi Email thông báo kết quả không trúng tuyển kèm lý do cụ thể.

### 2.3. Đăng nhập lần đầu & Cưỡng bức đổi mật khẩu (Mandatory Password Change)
- Sinh viên đăng nhập bằng: MSSV + Mật khẩu tạm thời nhận được trong Email.
- Hệ thống phát hiện `mustChangePassword == true` → **Cưỡng bức chuyển sang màn hình Đổi mật khẩu mới**. Chặn mọi thao tác khác cho tới khi đổi xong.
- Đổi mật khẩu thành công → Sinh viên vào Cổng nội trú: xem thông tin phòng/giường, quét mã VietQR đóng tiền và nhận mã QR check-in nhận phòng.

### 2.4. Quản lý cơ cấu không gian ở (Cơ sở → Tòa → Phòng → Giường)
- **Cơ sở (Campus):** 3 cơ sở đào tạo chính (CS1, CS2, CS3).
- **Tòa nhà (Building):** Thuộc từng cơ sở (VD: A1, B1...). Không có cờ `isActive`.
- **Phòng (Room):** Thuộc tòa nhà, có tầng (`floor`), số phòng (`roomNumber`), giới tính phòng (`gender`: `male`/`female`), loại phòng (`roomType`: `four_beds`, `six_beds`, `eight_beds`), trang bị điều hòa (`hasAirConditioner`), đơn giá chuẩn (`pricePerMonth`).
- **Giường/Chỗ ở (Bed):** Đơn vị xếp sinh viên nhỏ nhất trong phòng (VD: `P302-G01D`, `P302-G01T`). Trạng thái: `available`, `occupied`, `maintenance`.

### 2.5. Hợp đồng lưu trú (Contract Management) & Check-in QR
- Hợp đồng (`Contract`) gộp duy nhất đại diện cho chỗ ở của sinh viên trong năm học.
- Thời hạn thực tế: `8.5` tháng (tân sinh viên học cơ sở Hà Nam), hoặc `10–12` tháng (sinh viên năm 2 trở đi tại CS1/CS2).
- Đóng băng tiền phòng cả năm (`roomPrice = pricePerMonth × totalMonths`) và tiền cọc tài sản (`depositAmount`).
- **Check-in nhận phòng bằng mã QR:** Sinh viên mở mã QR cá nhân trên web/app khi đến KTX, cán bộ quét mã xác nhận nhận phòng và bàn giao giường trong 3 giây.
- Lịch sử hợp đồng được lưu trữ vĩnh viễn, phục vụ tra cứu xác nhận không nợ KTX khi sinh viên làm thủ tục tốt nghiệp ra trường.

### 2.6. Quản lý Tài chính, Điện nước & Thanh toán thông minh
- **Hóa đơn kỳ đầu (`initial`):** Tiền phòng cả năm + Tiền cọc tài sản.
- **Hóa đơn điện nước định kỳ (`utility`):** Cán bộ nhập chỉ số điện nước theo tháng dạng bảng của cả Tòa/Tầng (`UtilityReading`). Hệ thống tự động tính thành tiền và chia đều cho các sinh viên đang ở trong phòng (`Math.floor` + dồn phần dư cho MSSV nhỏ nhất).
- **Thanh toán VietQR động & VNPay:** Mỗi hóa đơn tự sinh mã QR ngân hàng nhúng sẵn số tiền và nội dung chuyển khoản chuẩn. Xử lý webhook thanh toán qua Queue chống nghẽn và đảm bảo idempotent.
- **Hóa đơn quyết toán (`settlement`):** Khi trả phòng, quyết toán cọc: `Tiền hoàn = Tiền cọc - Tiền điện nước nợ - Tiền bồi thường tài sản`. Cán bộ tạo phiếu chi `refund` hoàn tiền cho sinh viên.

### 2.7. Trải nghiệm KTX 4.0: Chat, Thông báo, Nghiệp vụ phát sinh
- **Kênh Chat hỗ trợ trực tuyến (Socket.io):** Sinh viên chat trực tiếp với Cán bộ KTX trực ca để hỏi thủ tục, báo sự cố khẩn cấp, gửi ảnh hiện trường hỏng hóc.
- **Thông báo đẩy (In-App Notifications):** Chuông thông báo thời gian thực khi có kết quả duyệt, hóa đơn mới, cập nhật sửa chữa.
- **Bảng tin KTX (Notice Board):** Cán bộ đăng thông báo chung (lịch cúp điện nước, vệ sinh định kỳ, nội quy).
- **Đơn xin chuyển phòng/giường (`transfer`):** Sinh viên nộp đơn online → Cán bộ duyệt gán giường mới, giải phóng giường cũ, tự động sinh hóa đơn bù trừ nếu đổi loại phòng khác giá.
- **Báo hỏng sửa chữa (`repair`):** Sinh viên gửi phiếu báo hỏng thiết bị kèm ảnh hiện trường → Theo dõi tiến độ sửa chữa.
- **Biên bản vi phạm nội quy (`Violation`):** Ghi nhận vi phạm, trừ điểm rèn luyện KTX làm căn cứ từ chối duyệt đơn năm sau.
- **Đơn xin trả phòng (`checkout`):** Sinh viên gửi yêu cầu trả phòng → Cán bộ kiểm kê tài sản, quyết toán hoàn cọc, cấp Giấy xác nhận hoàn thành nghĩa vụ KTX.

### 2.8. Phân cấp 4 vai trò người dùng (Roles)
- **`admin` (Quản trị hệ thống):** Quản lý kỹ thuật, tài khoản người dùng, cấu hình năm học, cơ sở đào tạo, bảo mật, sao lưu.
- **`manager` (Trưởng Ban quản lý KTX):** Phê duyệt đơn giá, mở/đóng đợt đăng ký KTX, duyệt danh sách sinh viên trúng tuyển, duyệt chuyển phòng, duyệt quyết toán cọc, xem toàn bộ báo cáo doanh thu & tỷ lệ lấp đầy.
- **`staff` (Cán bộ KTX vận hành & hỗ trợ):** Quản lý tòa/phòng/giường, quét mã QR nhận phòng, nhập chỉ số điện nước hàng tháng, tiếp nhận và điều phối sửa chữa báo hỏng, lập biên bản vi phạm, chat hỗ trợ trực tuyến.
- **`student` (Sinh viên HaUI):** Tra cứu kết quả xét duyệt, đổi mật khẩu, xem phòng/giường, quét VietQR thanh toán, mở mã QR nhận phòng, nộp đơn chuyển phòng/trả phòng, gửi báo hỏng, chat hỗ trợ trực tuyến.

---

## 3. Ngoài phạm vi (Out of Scope v1)

- ❌ Ứng dụng di động native (iOS/Android) — Web responsive tối ưu giao diện điện thoại.
- ❌ Module mua bán nhu yếu phẩm / giỏ hàng đồ dùng cá nhân (`SupplyItem`).
- ❌ Hệ thống phần cứng quẹt thẻ từ ra vào cổng KTX.
- ❌ Tách bảng loại phòng riêng (`RoomType`) — cấu hình trực tiếp trên `Room`.
- ❌ Module sinh viên tốt nghiệp riêng — lưu trong `Student` (`status: 'graduated'`).
