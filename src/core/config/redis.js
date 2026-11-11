/**
 * Quản lý kết nối Redis cho Hệ thống Quản lý Ký túc xá HaUI (HaUI - DMS).
 * 
 * ============================================================================
 * [DÀNH CHO TEAM 5 THÀNH VIÊN - LƯU Ý QUAN TRỌNG]:
 * - Hệ thống được cấu hình cơ chế "Graceful Fallback" (Dự phòng an toàn):
 *   + Nếu máy của bạn đã cài và đang chạy Redis: Hệ thống sẽ tự động dùng Redis thật.
 *   + Nếu máy của bạn KHÔNG có Redis (chưa cài hoặc tắt service): Hệ thống sẽ KHÔNG
 *     báo lỗi sập app, mà tự động chuyển sang bộ nhớ đệm In-Memory dự phòng.
 *   + Nhờ vậy, tất cả 5 thành viên trong team đều có thể chạy code mượt mà ngay cả
 *     khi chưa cài đặt Redis trên máy cá nhân!
 * ============================================================================
 */

const Redis = require('ioredis');
const config = require('./index');
const logger = require('../logger/logger');

let redisClient = null;
let isConnected = false;

// Khởi tạo kết nối Redis nếu được kích hoạt
if (config.redis.enabled) {
  try {
    redisClient = new Redis(config.redis.uri, {
      lazyConnect: true,
      connectTimeout: 1500,
      enableOfflineQueue: false, // Không giữ lệnh trong hàng đợi nếu offline
      maxRetriesPerRequest: 0, // Không retry lệnh khi offline
      retryStrategy() {
        return null; // Không retry kết nối, ngay lập tức dùng In-Memory
      },
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('🚀 [Redis] Đã kết nối thành công tới Redis Server.');
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      // Chỉ log cảnh báo nhẹ, không làm sập server
      logger.warn(`⚠️ [Redis] Không thể kết nối Redis (${err.message || 'Connection refused'}). Chuyển sang cơ chế In-Memory Cache.`);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    // Thử kết nối bất đồng bộ
    redisClient.connect().catch((err) => {
      isConnected = false;
      logger.warn(`⚠️ [Redis] Khởi tạo Redis offline: ${err.message}. Hệ thống sử dụng In-Memory Cache thay thế.`);
    });
  } catch (err) {
    isConnected = false;
    logger.warn(`⚠️ [Redis] Lỗi khi tạo Redis client: ${err.message}. Dùng In-Memory Cache.`);
  }
} else {
  logger.info('ℹ️ [Redis] Cấu hình ENABLE_REDIS=false, sử dụng In-Memory Cache nội bộ.');
}

/**
 * Kiểm tra trạng thái Redis có đang khả dụng không
 */
const isRedisConnected = () => isConnected;

module.exports = {
  redisClient,
  isRedisConnected,
};

