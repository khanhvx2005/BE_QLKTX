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

  payment: {
    vnpay: {
      tmnCode: process.env.VNP_TMN_CODE || process.env.VNPAY_CODE || '',
      hashSecret: process.env.VNP_HASH_SECRET || process.env.VNPAY_SECRET || '',
      url: process.env.VNP_URL || process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: process.env.VNP_RETURN_URL || 'http://localhost:5173/portal/payment-result',
    },
  },

  scheduler: {
    enableCron: process.env.ENABLE_CRON === 'true',
    timezone: process.env.TZ || 'Asia/Ho_Chi_Minh',
  },
};

module.exports = config;
