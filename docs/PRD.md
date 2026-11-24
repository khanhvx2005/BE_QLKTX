# Product Requirements Document (PRD) — HaUI - DMS (v3.0)

- **Tên hệ thống:** Hệ thống Quản lý Ký túc xá Đại học Công nghiệp Hà Nội (`HaUI - DMS`)
- **Đơn vị áp dụng:** Trung tâm Hỗ trợ sinh viên / Trung tâm Ký túc xá HaUI (`ssc.haui.edu.vn`)
- **Phiên bản:** v3.0 — Chuẩn hóa nghiệp vụ KTX HaUI 2026–2027 (3 Cơ sở địa giới mới · 4 Vai trò RBAC · 10 Modules · 11 Collections)

---

## 1. Bối Cảnh 3 Cơ Sở Thực Tế HaUI (Địa Giới Hành Chính 2026)

- **Cơ sở 1 (`cs1`):** Ngõ 296 / Số 298 Đường Cầu Diễn, Phường Tây Tựu, TP. Hà Nội — Tòa **A14, A15** (264 phòng, >1.100 chỗ).
- **Cơ sở 2 (`cs2`):** Tổ dân phố Thượng 2, Phường Tây Tựu, TP. Hà Nội — Tòa **B12, B14** (112 phòng, >476 chỗ).
- **Cơ sở 3 (`cs3`):** Phường Phù Vân, Tỉnh Ninh Bình — Tòa **C15, C16, C17** (330 phòng, >1.400 chỗ; tập trung đa số tân sinh viên năm nhất).

**Hạng phòng & Bảng giá năm học 2026–2027:**
- **Phòng Chất lượng cao (`high_quality` — Điều hòa, nóng lạnh, wifi, đệm, tủ):** 3 người giường gỗ (`930k / 930k / 900k`), 4 người (`700k / 700k / 680k`), 6 người (`470k / 470k / 460k`).
- **Phòng Tiêu chuẩn (`standard` — Nóng lạnh, quạt trần, wifi, tủ):** 4 người (`550k / 490k / 500k`), 6 người (`380k / 350k / 350k`).
- **Phòng Cơ bản (`basic`):** 4–6 người (quạt trần, tủ).
- **Điện nước:** Tính riêng hàng tháng theo chỉ số công tơ thực tế của từng phòng theo đơn giá Nhà nước.

---

## 2. Mục Tiêu Số Hóa Cốt Lõi (Không "Đồ Đá" Thủ Công)

1. **Trang chủ công khai & Đăng ký theo Đợt chuẩn HaUI:** Chỉ mở cổng nộp đơn khi có `RegistrationPeriod` đang `open`; tự động bóc 4 chữ số đầu MSSV (`YYYY60xxxx`) phân luồng **Tân SV năm nhất** (ngành Ngôn ngữ / Dệt may / Hóa–Thực phẩm / CLC vào CS1–CS2; ngành còn lại vào CS3 Ninh Bình) vs **SV năm 2+** (vào CS1–CS2).
2. **Xét duyệt ưu tiên & Tự động xếp phòng nhân văn:** Quản lý chỗ ở tinh gọn đến **cấp Phòng** (`capacity` & `occupiedCount`, sinh viên vào phòng tự sắp xếp giường với nhau); ưu tiên diện chính sách (`policy_family > poor_household > remote_area > normal`); tự động ưu tiên phòng tầng thấp (`floor <= 2`) cho sinh viên có vấn đề thể chất (`hasHealthCondition`); khóa chỗ nguyên tử (`$expr` + `$inc`) triệt tiêu 100% vượt sức chứa phòng.
3. **Đóng phí giữ chỗ → Tự động gạch nợ Webhook VietQR → Quét QR Check-in:** Duyệt đơn chuyển sang `pending_payment` (hạn 7 ngày). Quét VietQR tự động gạch nợ qua Webhook (kèm Simulator demo) → tự kích hoạt `active` & sinh mã **QR Check-in** nhận phòng 3 giây; quá hạn không đóng cho Hủy đơn nhả chỗ ngay, không kẹt chỗ bỏ cọc.
4. **Cổng dịch vụ Sinh viên toàn diện:** Báo hỏng sửa chữa (`repair`), Xin chuyển phòng (`transfer`), Đăng ký trả phòng (`checkout`), Chuông thông báo In-app & Bảng tin chung KTX, cùng quy trình Hoàn cọc có ghi nhận khấu trừ hư hại tài sản.
5. **Phân quyền 4 vai trò chuẩn mực:** `admin` (chỉ quản trị hệ thống & user), `manager` (Trưởng ban QLKTX: mở đợt, cấu hình tòa/phòng, duyệt chính sách, **xem Báo cáo Doanh thu 3 cơ sở**), `staff` (vận hành hàng ngày), `student` (sinh viên nội trú).

---

## 3. Ranh Giới Ngoài Hệ Thống (Out-of-Scope — Giữ Hạ Tầng Gọn Nhẹ)

1. Không dùng hàng đợi phân tán Redis / BullMQ (dùng MongoDB Atomic Update `$expr` + `$inc` & Partial Unique Index).
2. Không theo dõi vị trí từng giường lẻ (quản lý gọn đến cấp Phòng `capacity / occupiedCount`, sinh viên tự chia giường trong phòng).
3. Không xây dựng khung chat realtime kiểu Messenger (Socket.io) — thay bằng Phiếu Yêu cầu 2 chiều (`requests`) + Chuông Thông báo (`notifications`).
4. Không tích hợp phần cứng cổng từ / camera nhận diện khuôn mặt / công tơ IoT tự đọc.
5. Không mở đăng ký tài khoản tự do và không làm module bán nhu yếu phẩm.
