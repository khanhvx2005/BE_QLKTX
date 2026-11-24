/**
 * Điểm khởi chạy ứng dụng Backend HaUI - DMS.
 * Quy tắc: Kết nối MongoDB thành công TRƯỚC KHI mở cổng lắng nghe HTTP.
 */

const app = require('./app');
const config = require('./core/config');
const { connectDatabase } = require('./core/config/database');
const logger = require('./core/logger/logger');

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
    await connectDatabase();

    const server = app.listen(config.port, () => {
      logger.info(`[SERVER] HaUI - DMS Backend đang lắng nghe tại cổng ${config.port}`);
      logger.info(`[SERVER] Môi trường: ${config.env} | Health: http://localhost:${config.port}/api/health`);
    });

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
