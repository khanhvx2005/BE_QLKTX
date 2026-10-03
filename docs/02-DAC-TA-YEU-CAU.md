# 02 – ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)

**Đơn vị áp dụng:** Trường Đại học Công nghiệp Hà Nội (HaUI)  
**Hệ thống:** DMS – Hệ thống Quản lý Ký túc xá  
**Phiên bản:** 2.3 (Chuẩn hóa thực tế & Tự động cấp tài khoản qua Email, Ưu tiên thể chất)  
**Tài liệu tham chiếu:** `PRD.md` (phạm vi) · `DATA-SCHEMA.md` (dữ liệu) · `API.md` (endpoint)

---

## 1. Tác nhân hệ thống (Actors) & Phân cấp vai trò

```
                         SYSTEM ADMINISTRATOR (`admin`)
                               Quản trị hệ thống
                                       │
                               MANAGER (`manager`)
                            Lãnh đạo / Trưởng Ban KTX
                                       │
                                STAFF (`staff`)
                         Cán bộ KTX (Vận hành & Hỗ trợ)
                                       │
                                       ▼
                               STUDENT (`student`)
                                 Sinh viên HaUI
```

| Mã | Tác nhân | Vai trò (`role`) | Mô tả trách nhiệm & Quyền hạn |
|----|----------|------------------|-------------------------------|
| AC-1 | **System Administrator** | `admin` | **Quản trị kỹ thuật hệ thống:** Quản lý tài khoản, phân quyền, cấu hình năm học, cơ sở đào tạo, giám sát nhật ký hệ thống, tích hợp cổng thanh toán, Redis, Email Service và sao lưu dữ liệu. |
| AC-2 | **Manager** | `manager` | **Lãnh đạo / Trưởng Ban quản lý KTX:** Cấu hình đơn giá phòng, mở/đóng đợt đăng ký KTX, phê duyệt danh sách sinh viên trúng tuyển, duyệt đơn chuyển phòng, duyệt quyết toán cọc, xem toàn bộ báo cáo tài chính và tỷ lệ lấp đầy. |
| AC-3 | **Staff** | `staff` | **Cán bộ KTX (Vận hành & Hỗ trợ):** Quản lý tòa/phòng/giường, quét mã QR check-in bàn giao giường, nhập chỉ số điện nước hàng tháng, tiếp nhận và điều phối sửa chữa báo hỏng, lập biên bản vi phạm nội quy, thu tiền tại quầy, chat trực tuyến hỗ trợ sinh viên. |
| AC-4 | **Student** | `student` | **Sinh viên HaUI:** Nộp đơn đăng ký KTX công khai trong đợt mở (không cần tài khoản trước). Khai báo diện ưu tiên và nhu cầu giường tầng dưới nếu có vấn đề sức khỏe. Khi trúng tuyển, nhận Email chứa tài khoản và mật khẩu tạm; đăng nhập lần đầu bắt buộc đổi mật khẩu mới; sau đó vào Cổng xem phòng, quét mã VietQR nộp tiền, quét QR nhận phòng, gửi đơn chuyển phòng/trả phòng/báo hỏng, chat hỗ trợ trực tuyến. |
| AC-5 | **Payment Gateway** | (System) | Cổng thanh toán (VNPay / ZaloPay) gửi kết quả giao dịch về hệ thống qua Webhook. |
| AC-6 | **Scheduler & Queue** | (System) | Worker chạy ngầm: xử lý hàng đợi nộp đơn đăng ký cao điểm (BullMQ), gửi email thông báo, quét hợp đồng hết hạn, hóa đơn quá hạn. |

---

## 2. Bảng Yêu cầu Chức năng (Functional Requirements — FR)

### 2.1. M1 – Xác thực, Tài khoản & Tự động cấp quyền qua Email
- **FR-01:** Đăng nhập bằng Email/MSSV và mật khẩu; trả về JWT chứa vai trò (`admin`, `manager`, `staff`, `student`).
- **FR-02 (Tự động cấp tài khoản khi trúng tuyển KTX):** Hệ thống không mở form đăng ký tài khoản tự do. Khi sinh viên được duyệt trúng tuyển KTX, hệ thống **tự động tạo tài khoản người dùng**:
  - `Username`: Mã số sinh viên (MSSV).
  - `Password`: Mật khẩu khởi tạo tạm thời được băm an toàn (bcrypt).
  - `mustChangePassword`: `true`.
- **FR-03 (Gửi Email thông báo trúng tuyển & Thông tin đăng nhập):** Hệ thống tự động gửi Email tới sinh viên:
  - Chúc mừng trúng tuyển kèm thông tin: Cơ sở, Tòa nhà, Phòng, Vị trí giường được gán.
  - Cung cấp tài khoản đăng nhập (MSSV) và mật khẩu tạm thời.
  - Hướng dẫn đăng nhập đổi mật khẩu và thời hạn nộp tiền phòng/cọc qua VietQR (trong 7 ngày).
- **FR-04 (Cưỡng bức đổi mật khẩu ở lần đăng nhập đầu):** Khi sinh viên đăng nhập lần đầu bằng tài khoản tạm thời, hệ thống phát hiện `mustChangePassword == true` và cưỡng bức chuyển sang màn hình Đổi mật khẩu mới (chặn mọi thao tác khác cho tới khi đổi xong).
- **FR-05:** Cán bộ KTX cấp lại mật khẩu tạm khi sinh viên quên mật khẩu; hệ thống gửi lại email chứa mật khẩu mới và bật cờ `mustChangePassword`.
- **FR-06:** Phân quyền theo ma trận RBAC chặt chẽ: Sinh viên chỉ truy cập dữ liệu của chính mình (chặn IDOR tuyệt đối).

### 2.2. M2 – Quản lý Hồ sơ Sinh viên
- **FR-10:** Quản lý hồ sơ sinh viên: MSSV, Họ tên, Giới tính, Ngày sinh, SĐT, Email, Khoa, Lớp, Người liên hệ khẩn cấp.
- **FR-11:** Quản lý diện ưu tiên chính sách KTX: `policy_family` (con liệt sĩ/thương binh), `poor_household` (hộ nghèo/mồ côi), `remote_area` (vùng sâu xa), `normal` (bình thường).
- **FR-12:** Quản lý trạng thái học tập: `studying` (đang học), `graduated` (đã tốt nghiệp), `dropped_out` (thôi học).
- **FR-13:** Bảo lưu vĩnh viễn dữ liệu sinh viên tốt nghiệp kèm toàn bộ lịch sử hợp đồng và hóa đơn phục vụ đối soát và báo cáo.

### 2.3. M3 – Quản lý Không gian KTX & Phân định Giường tầng
- **FR-20:** Quản lý Cơ sở (`Campus`): CS1 (Bắc Từ Liêm), CS2 (Tây Tựu), CS3 (Hà Nam).
- **FR-21:** Quản lý Tòa nhà KTX (`Building`): thuộc Cơ sở, tên tòa, mã tòa, số tầng (`totalFloors`), có thang máy (`hasElevator`).
- **FR-22:** Quản lý Phòng (`Room`): số phòng, tầng (`floor`), giới tính (`male`/`female`), loại phòng (`four_beds`, `six_beds`, `eight_beds`), có điều hòa (`hasAirConditioner`), sức chứa (`capacity`), đơn giá quy định (`pricePerMonth`).
- **FR-23 (Phân định vị trí giường tầng):** Quản lý Giường (`Bed`): mã giường (VD: `P302-G01D`, `P302-G01T`), **vị trí tầng** (`position`: `lower` - tầng dưới, `upper` - tầng trên), trạng thái (`available`, `occupied`, `maintenance`).
- **FR-24:** Tự động sinh danh sách giường theo sức chứa khi khởi tạo phòng (tự chia đều giường tầng dưới và giường tầng trên); không cho phép số giường thực tế vượt quá sức chứa.
- **FR-25 (Tối ưu hóa phân vùng giới tính động - Smart Gender Zoning):** Cho phép hệ thống tự động tính toán nhu cầu số chỗ ở của Nam và Nữ từ số lượng đơn trúng tuyển thực tế để đề xuất/chuyển đổi giới tính hàng loạt các phòng trống theo 3 cấp độ ưu tiên (Cấp 1: Tách theo Tòa nhà thuần giới; Cấp 2: Tách trọn vẹn theo Tầng; Cấp 3: Tách theo Dãy phòng liền kề nếu phòng có WC khép kín) kết hợp bảo lưu cụm phòng tầng thấp cho sinh viên có vấn đề thể chất.
- **FR-26:** Kiểm tra giới tính nghiêm ngặt: Chặn xếp sinh viên vào phòng không trùng giới tính (`422 GENDER_MISMATCH`).
- **FR-27:** Chuyển trạng thái bảo trì giường: Giường đang `occupied` không được chuyển sang `maintenance`.
- **FR-28:** Tối ưu hóa tra cứu: Danh sách phòng trống (`/api/rooms/available`) được Caching bằng Redis để chịu tải khi hàng nghìn sinh viên cùng xem phòng.

### 2.4. M4 – Năm học & Đợt đăng ký KTX
- **FR-30:** Quản lý Năm học (`AcademicYear`): thiết lập năm học (VD: `2026-2027`), ngày bắt đầu, ngày kết thúc.
- **FR-31:** Quản lý Đợt mở đăng ký KTX (`RegistrationPeriod`): mở theo năm học, theo cơ sở, có thời gian mở/đóng cổng.
- **FR-32:** Tự động khóa cổng đăng ký khi hết thời hạn đợt đăng ký.

### 2.5. M5 – Đơn đăng ký KTX công khai & Ưu tiên thể chất (Applications & Accessibility)
- **FR-40 (Nộp đơn công khai không cần tài khoản):** Trong đợt mở, sinh viên truy cập cổng công khai, điền MSSV, Họ tên, Ngày sinh, CCCD, SĐT, Email, Khoa, Lớp, chọn Cơ sở, chọn nguyện vọng loại phòng, tải ảnh minh chứng diện ưu tiên.
- **FR-41 (Khai báo nhu cầu thể chất/sức khỏe):** Cho phép sinh viên khai báo `hasHealthCondition: true` nếu có khuyết tật vận động, bệnh lý tim mạch, chấn thương... kèm ảnh chụp giấy xác nhận y tế.
- **FR-42:** Ràng buộc mỗi sinh viên chỉ nộp tối đa 1 đơn đăng ký trong cùng một đợt (`periodId + studentId` unique).
- **FR-43 (Hàng đợi chống nghẽn Redis Queue):** Nộp đơn đợt cao điểm được xếp vào hàng đợi `queue:dorm-application` và phản hồi mã số vé hàng đợi ngay lập tức (phản hồi trong 5ms).
- **FR-44:** Hệ thống tự động gửi email xác nhận đã nhận đơn kèm mã tra cứu kết quả.
- **FR-45 (Tự động gán Giường tầng dưới cho SV có vấn đề thể chất):** Khi duyệt đơn sinh viên có `hasHealthCondition: true`, hệ thống **tự động lọc và chỉ cho phép gán giường tầng dưới (`Bed.position == 'lower'`)**, tuyệt đối chặn gán lên tầng trên. Với tòa không có thang máy, ưu tiên xếp vào phòng ở Tầng 1 hoặc Tầng 2.
- **FR-46 (Phê duyệt trúng tuyển):** Cập nhật giường sang `occupied` bằng thao tác nguyên tử, tự động sinh Hợp đồng, Hóa đơn ban đầu, sinh Tài khoản và kích hoạt gửi Email trúng tuyển kèm pass tạm.
- **FR-47 (Từ chối đơn):** Nhập lý do từ chối; hệ thống tự động gửi Email thông báo kết quả không trúng tuyển.

### 2.6. M6 – Quản lý Hợp đồng lưu trú & Check-in QR
- **FR-50:** Quản lý Hợp đồng gộp (`Contract`): mã hợp đồng `HD-YYYY-XXXXX`, sinh viên, giường, năm học, ngày bắt đầu, ngày kết thúc.
- **FR-51:** Thiết lập thời gian hợp đồng theo thực tế HaUI: `8.5` tháng (tân sinh viên cơ sở Hà Nam), `10` hoặc `12` tháng (sinh viên năm 2 trở đi).
- **FR-52:** Đóng băng đơn giá và tính tổng tiền phòng cả năm (`roomPrice = pricePerMonth × totalMonths`) kèm tiền cọc tài sản (`depositAmount`).
- **FR-53:** Check-in nhận phòng bằng mã QR: Sinh viên mở mã QR trên web/app; Staff quét mã xác nhận nhận phòng → cập nhật `checkinAt = now` và bàn giao giường trong 3 giây.
- **FR-54:** Tự động quét hợp đồng hết hạn (`expired`) qua Scheduler hàng ngày.

### 2.7. M7 – Quản lý Tài chính, Điện nước & Thanh toán thông minh
- **FR-60:** Hóa đơn kỳ đầu (`initial`): Thu tiền phòng cả năm + Tiền đặt cọc.
- **FR-61:** Nhập chỉ số điện nước theo tháng (`UtilityReading`): Hỗ trợ cán bộ nhập theo Tòa/Tầng dạng bảng. Bắt buộc `chỉ số cuối >= chỉ số đầu`.
- **FR-62:** Sinh hóa đơn điện nước định kỳ (`utility`): Hệ thống tự động tính thành tiền và chia đều cho tất cả sinh viên có hợp đồng `active` trong phòng ở tháng đó (`Math.floor` + dồn phần dư cho MSSV nhỏ nhất).
- **FR-63:** Khóa chỉ số: Không cho phép sửa đổi số công tơ sau khi đã sinh hóa đơn tháng.
- **FR-64:** Thanh toán thông minh qua VietQR động: Mỗi hóa đơn tự sinh mã VietQR nhúng sẵn STK KTX, số tiền chính xác và nội dung là mã hóa đơn.
- **FR-65:** Thanh toán trực tuyến cổng VNPay: Xử lý webhook qua hàng đợi `queue:payment-webhook` đảm bảo idempotent (chống ghi nhận trùng).
- **FR-66:** Thu tiền tại quầy: Cán bộ KTX ghi nhận thanh toán tiền mặt/chuyển khoản, sinh biên lai `Payment`.

### 2.8. M8 – Các nghiệp vụ phát sinh (Chuyển phòng, Báo hỏng, Kỷ luật)
- **FR-70:** Đơn xin chuyển phòng/giường (`transfer`): Sinh viên nộp đơn nêu lý do. Manager/Staff duyệt → gán giường mới, giải phóng giường cũ, tính bù trừ chênh lệch tiền phòng nếu đổi loại phòng.
- **FR-71:** Đơn xin trả phòng (`checkout`): Sinh viên nộp đơn khi kết thúc khóa học hoặc xin ra ngoài ở.
- **FR-72:** Quyết toán trả phòng (`settlement`): Kiểm kê tài sản phòng, trừ nợ điện nước còn thiếu, tính tiền hoàn cọc `refund = cọc - nợ - bồi thường`. Tạo phiếu chi `refund` hoàn tiền cho sinh viên, giải phóng giường về `available`.
- **FR-73:** Cấp xác nhận không nợ KTX: Hệ thống kiểm tra hợp đồng đã thanh lý và công nợ = 0 để sinh viên hoàn thành thủ tục tốt nghiệp.
- **FR-74:** Báo hỏng thiết bị (`repair`): Sinh viên gửi phiếu báo hỏng thiết bị phòng kèm ảnh hiện trường. Cán bộ KTX tiếp nhận, điều phối thợ sửa chữa và cập nhật tiến độ `pending → approved → completed`.
- **FR-75:** Biên bản vi phạm nội quy (`Violation`): Cán bộ KTX lập biên bản sinh viên vi phạm, ghi nhận mức phạt tiền và điểm rèn luyện KTX bị trừ.

### 2.9. M9 – Kênh Chat trực tuyến & Bảng tin KTX
- **FR-80:** Kênh Chat trực tuyến (Socket.io): Sinh viên chat trực tiếp thời gian thực với Cán bộ KTX trực ca để hỏi thủ tục, báo sự cố khẩn cấp, gửi ảnh hỏng hóc.
- **FR-81:** Thông báo đẩy (In-App Notification): Bắn thông báo chuông thời gian thực khi có kết quả duyệt đơn, có hóa đơn mới, cập nhật sửa chữa.
- **FR-82:** Bảng tin nội bộ KTX (Notice Board): Cán bộ đăng thông báo chung (lịch cúp điện nước, vệ sinh, nội quy nghỉ lễ).

### 2.10. M10 – Cổng sinh viên & Dashboard báo cáo
- **FR-90:** Cổng sinh viên: Xem phòng/giường/bạn cùng phòng, nộp đơn đăng ký KTX, quét mã VietQR thanh toán, mở mã QR nhận phòng, chat hỗ trợ, xem lịch sử hợp đồng và vi phạm.
- **FR-91:** Dashboard báo cáo: Tỷ lệ lấp đầy theo từng cơ sở (được cache Redis), tổng công nợ quá hạn, báo cáo thống kê sinh viên nội trú theo khoa, khóa, diện ưu tiên và sinh viên đã tốt nghiệp.
