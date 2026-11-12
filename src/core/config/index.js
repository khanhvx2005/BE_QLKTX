/**
 * Quản lý cấu hình toàn hệ thống từ biến môi trường.
 * Đảm bảo single source of truth cho configuration.
 */

const dotenv = require('dotenv');

// Nạp cấu hình từ .env
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
   * Tài khoản nhận tiền cho mã VietQR (FR-53). Mặc định là SỐ MẪU — điền tài khoản thật vào .env khi triển khai.
   * bankBin là mã BIN ngân hàng 6 số (VD 970436 Vietcombank).
   */
  vietqr: {
    bankBin: process.env.VIETQR_BANK_BIN || '970436',
    accountNumber: process.env.VIETQR_ACCOUNT_NUMBER || '0011001234567',
    accountName: process.env.VIETQR_ACCOUNT_NAME || 'KY TUC XA HAUI',
  },

  scheduler: {
    enableCron: process.env.ENABLE_CRON === 'true',
    timezone: process.env.TZ || 'Asia/Ho_Chi_Minh',
  },

  redis: {
    uri: process.env.REDIS_URI || process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    enabled: process.env.ENABLE_REDIS !== 'false',
  },
};

module.exports = config;
