/**
 * Khởi tạo ứng dụng Express và cấu hình các middleware toàn cục.
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md (Hệ thống HaUI - DMS v2.0 tinh gọn).
 * 
 * ============================================================================
 * [CẤU TRÚC ĐỊNH TUYẾN 8 MODULES CHUẨN]:
 * 1. M1: /api/auth & /api/users - Xác thực và Quản lý tài khoản
 * 2. M2: /api/students - Quản lý Hồ sơ Sinh viên HaUI
 * 3. M3: /api - Quản lý Tòa nhà & Phòng KTX
 * 4. M4: /api/contracts - Đăng ký KTX Online & Hợp đồng lưu trú
 * 5. M5: /api - Chỉ số Điện Nước & Hóa đơn theo Phòng
 * 6. M6: /api/payments - Thanh toán (Tiền mặt & VietQR) & Hoàn cọc
 * 7. M7: /api/portal - Cổng dịch vụ Sinh viên KTX
 * 8. M8: /api/dashboard - Dashboard & Báo cáo Thống kê
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const config = require('./core/config');
const requestLogger = require('./core/middlewares/request-logger');
const errorHandler = require('./core/middlewares/error-handler');
const ApiError = require('./core/errors/api-error');
const ApiResponse = require('./core/utils/response');

const app = express();

// 1. Cấu hình CORS
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

// 2. Parse dữ liệu đầu vào JSON & URL-encoded
app.use(express.json({ limit: '10mb' })); // Cho phép tải dữ liệu danh sách import Excel lớn
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Middleware ghi log request HTTP
app.use(requestLogger);

// 4. Endpoint kiểm tra trạng thái dịch vụ (Health Check)
app.get('/api/health', (req, res) => {
  return ApiResponse.success(
    res,
    {
      status: 'healthy',
      system: 'HaUI - DMS (Dormitory Management System)',
      env: config.env,
      timestamp: new Date().toISOString(),
    },
    'Hệ thống Quản lý Ký túc xá HaUI - DMS đang hoạt động ổn định'
  );
});

// 5. Đăng ký các router của 8 module cốt lõi

// M1: Xác thực & Quản lý Tài khoản
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/auth/user.routes');
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// M2: Quản lý Hồ sơ Sinh viên HaUI
const studentRoutes = require('./modules/students/student.routes');
app.use('/api/students', studentRoutes);

// M3: Cơ sở Vật chất: Tòa nhà & Phòng KTX
const roomRoutes = require('./modules/rooms/room.routes');
app.use('/api', roomRoutes);

// M4: Đăng ký KTX Online & Hợp đồng lưu trú
const contractRoutes = require('./modules/contracts/contract.routes');
const publicRoutes = require('./modules/contracts/public.routes');
app.use('/api/contracts', contractRoutes);
// Không cần token: phòng còn trống cho người nộp đơn, tra cứu đơn (API.md §5)
app.use('/api/public', publicRoutes);

// M5: Chỉ số Điện Nước & Hóa đơn theo Phòng
const feeRoutes = require('./modules/fees/fee.routes');
app.use('/api', feeRoutes);

// M6: Thanh toán (Tiền mặt & VietQR) & Hoàn cọc
const paymentRoutes = require('./modules/payments/payment.routes');
app.use('/api/payments', paymentRoutes);

// M7: Cổng Dịch vụ Sinh viên (Portal)
const portalRoutes = require('./modules/portal/portal.routes');
app.use('/api/portal', portalRoutes);

// M8: Dashboard & Báo cáo Thống kê
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
app.use('/api/dashboard', dashboardRoutes);

// 6. Xử lý đường dẫn không tồn tại (404 Not Found)
app.use((req, res, next) => {
  next(
    new ApiError(
      404,
      'NOT_FOUND',
      `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`
    )
  );
});

// 7. Middleware bắt và chuẩn hóa lỗi tập trung toàn hệ thống
app.use(errorHandler);

module.exports = app;
