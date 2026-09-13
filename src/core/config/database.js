/**
 * Kết nối CSDL MongoDB thông qua Mongoose.
 * Triển khai theo đặc tả tại ARCHITECTURE.md §10.
 */

const mongoose = require('mongoose');
const config = require('./index');

async function connectDatabase() {
  const uri = config.database.uri;
  if (!uri) {
    console.error('[DB] Lỗi: Chưa cấu hình MONGODB_URI trong .env');
    process.exit(1);
  }

  // Mongoose 8/9 khuyến nghị strictQuery = true
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // Thất bại sau 10 giây thay vì treo tiến trình
      socketTimeoutMS: 45000,          // Ngắt truy vấn treo sau 45s
      maxPoolSize: 10,                 // Tối ưu connection pool cho cụm Atlas M0 Free
    });
    console.log(`[DB] ✅ Kết nối MongoDB Atlas thành công → CSDL: ${mongoose.connection.name} (Host: ${mongoose.connection.host})`);
  } catch (err) {
    console.error('[DB] ❌ Kết nối MongoDB Atlas thất bại:', err.message);
    // Không cho phép server khởi động nếu không có kết nối cơ sở dữ liệu
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] ⚠️ Mất kết nối tới MongoDB Atlas');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[DB] 🔄 Đã tái kết nối thành công tới MongoDB Atlas');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[DB] ❌ Lỗi kết nối MongoDB Atlas:', err.message);
  });

  // Graceful shutdown khi nhận tín hiệu kết thúc tiến trình
  const gracefulShutdown = async (signal) => {
    try {
      await mongoose.connection.close(false);
      console.log(`[DB] Đã đóng kết nối MongoDB an toàn do nhận tín hiệu ${signal}`);
      process.exit(0);
    } catch (closeErr) {
      console.error('[DB] Lỗi khi đóng kết nối MongoDB:', closeErr.message);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

module.exports = { connectDatabase, connectDB: connectDatabase };

