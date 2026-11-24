/**
 * Quản lý cấu hình toàn hệ thống từ biến môi trường (.env).
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

  /** Tài khoản nhận tiền VietQR động chuẩn NAPAS 247 & bí mật Webhook SePay/Casso */
  vietqr: {
    bankBin: process.env.VIETQR_BANK_BIN || '970436',
    accountNumber: process.env.VIETQR_ACCOUNT_NUMBER || '0011001234567',
    accountName: process.env.VIETQR_ACCOUNT_NAME || 'KY TUC XA HAUI',
    webhookSecret: process.env.VIETQR_WEBHOOK_SECRET || 'haui_dms_vietqr_webhook_secret_2026',
  },

  /** Cấu hình SMTP (Nodemailer) */
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || 'Trung tâm Ký túc xá ĐH Công nghiệp Hà Nội (HaUI - DMS)',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
};

module.exports = config;
