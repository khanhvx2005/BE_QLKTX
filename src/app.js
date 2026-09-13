/**
 * Khởi tạo ứng dụng Express và cấu hình các middleware toàn cục.
 * Tuân thủ theo ARCHITECTURE.md §3.3 và 07-PHAN-QUYEN-BAO-MAT.md §5.4.
 */

const express = require('express');
const cors = require('cors');
const config = require('./core/config');
const requestLogger = require('./core/middlewares/request-logger');
const errorHandler = require('./core/middlewares/error-handler');
const ApiError = require('./core/errors/api-error');
const ApiResponse = require('./core/utils/response');

const app = express();

// 1. Cấu hình CORS theo whitelist từ biến môi trường (07 §5.4)
app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép request từ cùng nguồn (mobile/postman không có origin) hoặc nằm trong danh sách CORS_ORIGIN
      if (!origin || config.cors.origin.includes(origin) || config.cors.origin.includes('*')) {
        callback(null, true);
      } else {
        callback(new ApiError(403, 'FORBIDDEN', `Nguồn truy cập bị chặn bởi CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);

// 2. Parse dữ liệu đầu vào (07 §5.4: giới hạn kích thước 1mb để phòng ngừa tấn công)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 3. Middleware ghi log request HTTP
app.use(requestLogger);

// 4. Endpoint kiểm tra trạng thái dịch vụ (Health Check)
app.get('/api/health', (req, res) => {
  return ApiResponse.success(
    res,
    {
      status: 'healthy',
      env: config.env,
      timestamp: new Date().toISOString(),
    },
    'Hệ thống Quản lý Ký túc xá DMS-KTX đang hoạt động'
  );
});

// 5. Nơi đăng ký các router của từng module (ARCHITECTURE.md §3.3)
const authRoutes = require('./modules/auth/auth.routes');
const authController = require('./modules/auth/auth.controller');
const { authenticate, authorize } = require('./core/middlewares/auth');

app.use('/api/auth', authRoutes);
// Hỗ trợ endpoint reset-password theo đúng chuẩn API.md §2: POST /api/users/:id/reset-password
app.post('/api/users/:id/reset-password', authenticate, authorize('admin', 'staff'), authController.resetPassword);

// Mount module students (API.md §3)
const studentRoutes = require('./modules/students/student.routes');
app.use('/api/students', studentRoutes);

// Mount module rooms: buildings, rooms, beds (API.md §4)
const roomRoutes = require('./modules/rooms/room.routes');
app.use('/api', roomRoutes);

// Mount module residencies (API.md §5)
const residencyRoutes = require('./modules/residencies/residency.routes');
app.use('/api/residencies', residencyRoutes);

// Mount module contracts (API.md §6)
const contractRoutes = require('./modules/contracts/contract.routes');
app.use('/api/contracts', contractRoutes);

// Mount module fees: fee-types, utility-readings, invoices (API.md §7)
const feeRoutes = require('./modules/fees/fee.routes');
app.use('/api', feeRoutes);

// Mount module payments (API.md §8)
const paymentRoutes = require('./modules/payments/payment.routes');
app.use('/api/payments', paymentRoutes);

// Mount module requests (API.md §9 & §10)
const requestRoutes = require('./modules/requests/request.routes');
app.use('/api/requests', requestRoutes);
app.use('/api/portal/my-requests', requestRoutes);

// Mount module dashboard (API.md §11)
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
