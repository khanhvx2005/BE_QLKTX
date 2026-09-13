/**
 * Điểm khởi chạy của ứng dụng backend DMS-KTX.
 * Tuân thủ quy tắc ARCHITECTURE.md §10: Kết nối MongoDB thành công TRƯỚC KHI lắng nghe cổng.
 */

const app = require('./app');
const config = require('./core/config');
const { connectDatabase } = require('./core/config/database');
const logger = require('./core/logger/logger');

// Bắt các ngoại lệ không được xử lý để ghi log trước khi thoát
process.on('uncaughtException', (err) => {
  logger.error('Ngoại lệ chưa được xử lý (uncaughtException):', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promise bị từ chối chưa được xử lý (unhandledRejection):', reason);
  process.exit(1);
});

async function bootstrap() {
  try {
    // 1. Kết nối cơ sở dữ liệu MongoDB
    await connectDatabase();

    // 2. Kích hoạt trình lập lịch tác vụ nền hằng ngày (14-PHIEN-BAN-DON-GIAN-HOA.md §4.9)
    const { startScheduler } = require('./core/cron/scheduler');
    startScheduler();

    // 3. Lắng nghe HTTP request
    const server = app.listen(config.port, () => {
      logger.info(`[SERVER] DMS-KTX Backend đang lắng nghe tại cổng ${config.port}`);
      logger.info(`[SERVER] Môi trường: ${config.env} | URL: http://localhost:${config.port}/api/health`);
    });

    // 3. Xử lý đóng ứng dụng an toàn (Graceful Shutdown)
    const handleShutdown = (signal) => {
      logger.info(`Nhận tín hiệu ${signal}, đang đóng kết nối an toàn...`);
      server.close(() => {
        logger.info('HTTP Server đã đóng.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (err) {
    logger.error('Lỗi khi khởi động server:', err);
    process.exit(1);
  }
}

bootstrap();
