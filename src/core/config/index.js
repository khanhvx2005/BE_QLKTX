/**
 * Quản lý cấu hình toàn hệ thống từ biến môi trường (.env).
 * Single source of truth cho toàn bộ thông số cấu hình Backend.
 */

const dotenv = require('dotenv');

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
  port: parseInt(process.env.PORT, 10) || 5000,

  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dms_ktx',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_key_change_in_production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
  },

  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : ['http://localhost:5173'],
  },

  /**
   * Tài khoản nhận tiền cho mã VietQR động (chuẩn NAPAS 247).
   * Mặc định dùng số mẫu khi chạy thử — cấu hình tài khoản thật trong .env khi triển khai.
   */
  vietqr: {
    bankBin: process.env.VIETQR_BANK_BIN || '970436',
    accountNumber: process.env.VIETQR_ACCOUNT_NUMBER || '0011001234567',
    accountName: process.env.VIETQR_ACCOUNT_NAME || 'KY TUC XA HAUI',
  },

  /**
   * Cấu hình SMTP (Nodemailer) gửi email cấp tài khoản & kết quả xét duyệt đơn KTX.
   * Nếu bỏ trống SMTP_USER / SMTP_PASS, hệ thống tự động bỏ qua gửi mail thật và ghi log.
   */
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || 'Ký túc xá Đại học Công nghiệp Hà Nội (HaUI - DMS)',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
};

module.exports = config;
