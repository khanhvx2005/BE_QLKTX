/**
 * Khởi tạo ứng dụng Express và đăng ký 10 phân hệ nghiệp vụ HaUI - DMS v3.0.
 * Tuân thủ EDIT_DOCS_DAC_TA_YEU_CAU.md · EDIT_DOCS_DATA_SCHEMA.md · API.md.
 *
 * [10 PHÂN HỆ NGHIỆP VỤ — 11 COLLECTIONS — 4 VAI TRÒ RBAC]:
 *  1. auth          : /api/auth, /api/users (Admin quản trị user; Manager/Staff reset MK SV)
 *  2. students      : /api/students (Hồ sơ SV HaUI, trích xuất khóa từ MSSV, Import Excel)
 *  3. rooms         : /api/buildings, /api/rooms (3 Cơ sở địa giới 2026, bảng giá 2026-2027, quản lý cấp Phòng)
 *  4. periods       : /api/periods (Đợt đăng ký theo học kỳ & phân luồng Tân SV / Năm 2+)
 *  5. contracts     : /api/public, /api/contracts (Trang chủ công khai, nộp/hủy đơn, duyệt tự động, pending_payment, QR Check-in, hoàn cọc)
 *  6. fees          : /api/utility-readings, /api/invoices (Điện nước bảng lưới nối tiếp chỉ số, chốt HĐ Phòng + TB/Email)
 *  7. payments      : /api/payments (Tiền mặt, Webhook VietQR tự động + Simulator, phiếu chi hoàn cọc)
 *  8. requests      : /api/requests (Báo hỏng sửa chữa, Chuyển phòng nguyên tử, Đăng ký trả phòng)
 *  9. notifications : /api/notifications (Bảng tin KTX công khai & Chuông thông báo)
 * 10. portal & dashboard : /api/portal (Cổng SV tự phục vụ), /api/dashboard (Thống kê 3 cơ sở & Doanh thu riêng Manager)
 */

const express = require('express');
const cors = require('cors');
const config = require('./core/config');
const requestLogger = require('./core/middlewares/request-logger');
const errorHandler = require('./core/middlewares/error-handler');
const ApiError = require('./core/errors/api-error');
const ApiResponse = require('./core/utils/response');

const app = express();

// 1. CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.cors.origin.includes(origin) || config.cors.origin.includes('*')) {
        callback(null, true);
      } else {
        callback(new ApiError(403, 'FORBIDDEN', `Nguồn truy cập bị chặn bởi CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);

// 2. Parse JSON & URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Request Logger
app.use(requestLogger);

// 4. Health Check
app.get('/api/health', (req, res) => {
  return ApiResponse.success(
    res,
    {
      status: 'healthy',
      system: 'HaUI - DMS (Dormitory Management System)',
      version: '3.0.0',
      env: config.env,
      timestamp: new Date().toISOString(),
    },
    'Hệ thống Quản lý Ký túc xá ĐH Công nghiệp Hà Nội (HaUI - DMS v3.0) đang hoạt động ổn định'
  );
});

// 5. Đăng ký 10 phân hệ nghiệp vụ

// M1: Xác thực & Quản lý Tài khoản
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/users', require('./modules/auth/user.routes'));

// M2: Quản lý Hồ sơ Sinh viên HaUI
app.use('/api/students', require('./modules/students/student.routes'));

// M3: Cơ sở Vật chất 3 Cơ sở: Tòa nhà & Phòng
app.use('/api', require('./modules/rooms/room.routes'));

// M4: Quản lý Đợt Đăng ký KTX
app.use('/api/periods', require('./modules/periods/period.routes'));

// M5: Trang chủ Công khai & Hợp đồng lưu trú
app.use('/api/contracts', require('./modules/contracts/contract.routes'));
app.use('/api/public', require('./modules/contracts/public.routes'));

// M6: Điện Nước & Hóa đơn
app.use('/api', require('./modules/fees/fee.routes'));

// M7: Thanh toán (Cash, Webhook VietQR tự động & Simulator, Hoàn cọc)
app.use('/api/payments', require('./modules/payments/payment.routes'));

// M8: Phiếu Yêu cầu Trực tuyến của Sinh viên (Báo hỏng / Chuyển phòng / Trả phòng)
app.use('/api/requests', require('./modules/requests/request.routes'));

// M9: Bảng tin KTX & Thông báo
app.use('/api/notifications', require('./modules/notifications/notification.routes'));

// M10: Cổng Dịch vụ Sinh viên & Dashboard 3 Cơ sở
app.use('/api/portal', require('./modules/portal/portal.routes'));
app.use('/api/dashboard', require('./modules/dashboard/dashboard.routes'));

// 6. 404 Not Found
app.use((req, res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`));
});

// 7. Error Handler tập trung
app.use(errorHandler);

module.exports = app;
